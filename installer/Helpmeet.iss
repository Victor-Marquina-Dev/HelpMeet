; ============================================================
;  Helpmeet — Instalador (Inno Setup 6)
;  Instala POR USUARIO, sin privilegios de administrador.
;  Compilar con:  iscc /DMyAppVersion=0.1.0 installer\Helpmeet.iss
;  (lo hace automáticamente scripts\build_installer.ps1)
; ============================================================

#ifndef MyAppVersion
  #define MyAppVersion "0.0.0"
#endif

#define MyAppName "Helpmeet"
#define MyAppPublisher "MimoTech"
#define MyAppExeName "Helpmeet.exe"
#define MyAppId "MimoTech.Helpmeet.Desktop"
; URL oficial del bootstrapper Evergreen de WebView2 (Microsoft).
#define WebView2Url "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

[Setup]
; AppId fija la identidad: así las actualizaciones reemplazan la versión previa
; en lugar de instalar una copia paralela.
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
VersionInfoVersion={#MyAppVersion}
; Instalación por usuario, sin UAC. El usuario puede elegir "para todos" si tiene
; permisos, pero por defecto no se requiere administrador.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
DefaultDirName={autopf}\Helpmeet
DisableProgramGroupPage=yes
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
SetupIconFile=..\helpmeet\ui\web\assets\helpmeet.ico
OutputDir=..\dist\installer
OutputBaseFilename=Helpmeet-Setup-{#MyAppVersion}
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "Crear un acceso directo en el escritorio"; GroupDescription: "Accesos directos:"; Flags: unchecked

[Files]
; Carpeta generada por PyInstaller (onedir): dist\Helpmeet\
Source: "..\dist\Helpmeet\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Licencias de terceros
Source: "..\licenses\THIRD_PARTY_LICENSES.md"; DestDir: "{app}\licenses"; Flags: ignoreversion

[Icons]
; Los accesos llevan el AppUserModelID para que Windows agrupe la app y muestre
; su icono en la barra de tareas (igual que en ejecución).
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; AppUserModelID: "{#MyAppId}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; AppUserModelID: "{#MyAppId}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Iniciar Helpmeet"; Flags: nowait postinstall skipifsilent

[Code]
{ ---------- Detección e instalación de WebView2 Evergreen Runtime ---------- }
function PvPresent(RootKey: Integer; SubKey: String): Boolean;
var
  Version: String;
begin
  Result := RegQueryStringValue(RootKey, SubKey, 'pv', Version)
    and (Version <> '') and (Version <> '0.0.0.0');
end;

function WebView2Installed(): Boolean;
var
  Guid: String;
begin
  { GUID del cliente WebView2 en EdgeUpdate. Construido con Chr() para evitar
    llaves literales (que Inno interpretaría como constantes). }
  Guid := Chr(123) + 'F3017226-FE2A-4295-8BDF-00C3A9A7E4C5' + Chr(125);
  { Per-machine (HKLM) registra bajo WOW6432Node en Windows de 64 bits;
    per-user (HKCU) registra sin WOW6432Node. Comprobamos ambos. }
  Result :=
    PvPresent(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\' + Guid) or
    PvPresent(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + Guid) or
    PvPresent(HKCU, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\' + Guid);
end;

procedure InstallWebView2();
var
  TempFile: String;
  ResultCode: Integer;
begin
  TempFile := ExpandConstant('{tmp}\MicrosoftEdgeWebview2Setup.exe');
  try
    DownloadTemporaryFile('{#WebView2Url}', 'MicrosoftEdgeWebview2Setup.exe', '', nil);
  except
    { Sin conexión o fallo de descarga: la app avisará igualmente en su
      pantalla de diagnóstico. No bloqueamos la instalación por ello. }
    Exit;
  end;
  if FileExists(TempFile) then
    Exec(TempFile, '/silent /install', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    if not WebView2Installed() then
      InstallWebView2();
  end;
end;

{ ---------- Desinstalación: conservar los datos del usuario ---------- }
{ Los datos personales (base de datos, grabaciones, ajustes) viven en
  %LOCALAPPDATA%\Helpmeet, FUERA de la carpeta del programa, así que la
  desinstalación normal NO los toca. Solo si el usuario lo confirma de forma
  explícita se borran. }
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  DataDir: String;
begin
  if CurUninstallStep = usUninstall then
  begin
    DataDir := ExpandConstant('{localappdata}\Helpmeet');
    if DirExists(DataDir) then
    begin
      if MsgBox('¿Quieres borrar también tus datos de Helpmeet (grabaciones, '
        + 'transcripciones, base de datos y ajustes)?' + #13#10 + #13#10
        + 'Elige "No" para conservarlos por si vuelves a instalar Helpmeet.',
        mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        DelTree(DataDir, True, True, True);
      end;
    end;
  end;
end;
