"""Versión publicada de la app de escritorio.

Endpoint público y sin datos sensibles: la app lo consulta al arrancar para
avisar al usuario cuando hay una versión más nueva. Publicar una versión =
cambiar LATEST_APP_VERSION y LATEST_APP_URL en Railway (sin desplegar código).
"""
from fastapi import APIRouter
from helpmeet_licenses.config import settings

router = APIRouter(prefix="/api")


@router.get("/version")
def latest_version():
    return {
        "version": settings.latest_app_version,
        "url": settings.latest_app_url,
    }
