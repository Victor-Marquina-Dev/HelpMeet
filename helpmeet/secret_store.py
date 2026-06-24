"""Almacén seguro de secretos del usuario (Windows Credential Manager)."""

from __future__ import annotations

import ctypes
import os
import sys
from ctypes import wintypes


TARGET = "MimoTech.Helpmeet.Replicate"
_TYPE_GENERIC = 1
_PERSIST_LOCAL_MACHINE = 2


class _FILETIME(ctypes.Structure):
    _fields_ = [("dwLowDateTime", wintypes.DWORD),
                ("dwHighDateTime", wintypes.DWORD)]


class _CREDENTIALW(ctypes.Structure):
    _fields_ = [
        ("Flags", wintypes.DWORD),
        ("Type", wintypes.DWORD),
        ("TargetName", wintypes.LPWSTR),
        ("Comment", wintypes.LPWSTR),
        ("LastWritten", _FILETIME),
        ("CredentialBlobSize", wintypes.DWORD),
        ("CredentialBlob", ctypes.POINTER(ctypes.c_ubyte)),
        ("Persist", wintypes.DWORD),
        ("AttributeCount", wintypes.DWORD),
        ("Attributes", ctypes.c_void_p),
        ("TargetAlias", wintypes.LPWSTR),
        ("UserName", wintypes.LPWSTR),
    ]


def _advapi():
    if not sys.platform.startswith("win"):
        return None
    api = ctypes.WinDLL("Advapi32.dll", use_last_error=True)
    api.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                              ctypes.POINTER(ctypes.POINTER(_CREDENTIALW))]
    api.CredReadW.restype = wintypes.BOOL
    api.CredWriteW.argtypes = [ctypes.POINTER(_CREDENTIALW), wintypes.DWORD]
    api.CredWriteW.restype = wintypes.BOOL
    api.CredDeleteW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD]
    api.CredDeleteW.restype = wintypes.BOOL
    api.CredFree.argtypes = [ctypes.c_void_p]
    return api


def get_secret() -> str:
    api = _advapi()
    if api is None:
        return ""
    pointer = ctypes.POINTER(_CREDENTIALW)()
    if not api.CredReadW(TARGET, _TYPE_GENERIC, 0, ctypes.byref(pointer)):
        return ""
    try:
        credential = pointer.contents
        if not credential.CredentialBlob or not credential.CredentialBlobSize:
            return ""
        raw = ctypes.string_at(credential.CredentialBlob,
                               credential.CredentialBlobSize)
        return raw.decode("utf-16-le")
    finally:
        api.CredFree(pointer)


def set_secret(value: str) -> None:
    api = _advapi()
    if api is None:
        raise OSError("El almacén seguro solo está disponible en Windows.")
    value = (value or "").strip()
    if not value:
        delete_secret()
        return
    raw = value.encode("utf-16-le")
    if len(raw) > 5120:
        raise ValueError("El secreto es demasiado largo para Credenciales de Windows.")
    blob = (ctypes.c_ubyte * len(raw)).from_buffer_copy(raw)
    credential = _CREDENTIALW()
    credential.Type = _TYPE_GENERIC
    credential.TargetName = TARGET
    credential.Comment = "API key de Replicate para Helpmeet"
    credential.CredentialBlobSize = len(raw)
    credential.CredentialBlob = ctypes.cast(blob, ctypes.POINTER(ctypes.c_ubyte))
    credential.Persist = _PERSIST_LOCAL_MACHINE
    credential.UserName = os.environ.get("USERNAME", "Helpmeet")
    if not api.CredWriteW(ctypes.byref(credential), 0):
        raise ctypes.WinError(ctypes.get_last_error())


def delete_secret() -> None:
    api = _advapi()
    if api is None:
        return
    if not api.CredDeleteW(TARGET, _TYPE_GENERIC, 0):
        error = ctypes.get_last_error()
        if error != 1168:  # ERROR_NOT_FOUND
            raise ctypes.WinError(error)
