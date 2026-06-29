# build_release.ps1 — Pipeline completo de build para Helpmeet.
# Uso: .\scripts\build_release.ps1 [-Version "1.2.7"] [-Sign]
#
# Sin -Sign: build sin firma (para pruebas locales).
# Con -Sign:  requiere Windows SDK y certificado configurado.
#
# Prerequisitos:
#   - .venv con PyInstaller instalado
#   - Inno Setup 6 instalado (iscc.exe en PATH o ISCC_PATH)
#   - Para -Sign: signtool.exe en PATH (Windows SDK)

param(
    [string]$Version = "",
    [switch]$Sign = $false
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$ok = $true

function Step($msg)  { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Pass($msg)  { Write-Host "  OK  $msg" -ForegroundColor Green }
function Fail($msg)  { Write-Host "  FAIL $msg" -ForegroundColor Red; $script:ok = $false }
function Warn($msg)  { Write-Host "  WARN $msg" -ForegroundColor Yellow }
function Skip($msg)  { Write-Host "  SKIP $msg" -ForegroundColor DarkGray }

# Detectar versión
if (-not $Version) {
    $vf = "$root\helpmeet\version.py"
    if (Test-Path $vf) {
        $line = Get-Content $vf | Where-Object { $_ -match '__version__' }
        if ($line -match '"([^"]+)"') { $Version = $Matches[1] }
    }
}
if (-not $Version) { $Version = "0.0.0" }
Write-Host "Version: $Version" -ForegroundColor White

# ------------------------------------------------------------------
# 1. Ejecutar validación completa
# ------------------------------------------------------------------
Step "Validacion (tests + sintaxis)"
try {
    & "$root\scripts\check_all.ps1"
    if ($LASTEXITCODE -eq 0) { Pass "Validacion OK" }
    else { Fail "Validacion fallida — corrige errores antes de compilar" }
} catch { Fail "Error ejecutando check_all.ps1: $_" }

if (-not $ok) {
    Write-Host "`nBuild cancelado: validacion fallida." -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# 2. Actualizar version_info.txt
# ------------------------------------------------------------------
Step "Actualizando version_info.txt"
try {
    & ".\.venv\Scripts\python.exe" "$root\installer\gen_version.py"
    Pass "version_info.txt actualizado a $Version"
} catch { Warn "No se pudo actualizar version_info.txt: $_" }

# ------------------------------------------------------------------
# 3. Limpiar build anterior
# ------------------------------------------------------------------
Step "Limpiando build anterior"
@("$root\dist\Helpmeet", "$root\build") | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item $_ -Recurse -Force
        Pass "Eliminado: $_"
    }
}

# ------------------------------------------------------------------
# 4. Compilar con PyInstaller
# ------------------------------------------------------------------
Step "Compilando con PyInstaller"
Push-Location $root
try {
    & ".\.venv\Scripts\python.exe" -m PyInstaller Helpmeet.spec --noconfirm
    if ($LASTEXITCODE -eq 0) { Pass "PyInstaller OK — dist\Helpmeet\Helpmeet.exe generado" }
    else { Fail "PyInstaller falló" }
} catch { Fail "Error en PyInstaller: $_" }
finally { Pop-Location }

if (-not $ok) { Write-Host "`nBuild cancelado: PyInstaller falló." -ForegroundColor Red; exit 1 }

# ------------------------------------------------------------------
# 5. Firmar Helpmeet.exe (solo con -Sign)
# ------------------------------------------------------------------
Step "Firma digital del ejecutable"
$exePath = "$root\dist\Helpmeet\Helpmeet.exe"
if ($Sign) {
    try {
        signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /a $exePath
        signtool verify /pa /v $exePath
        Pass "Helpmeet.exe firmado y verificado"
    } catch { Fail "Error al firmar Helpmeet.exe: $_" }
} else {
    Skip "Firma omitida (usa -Sign para firmar)"
    Warn "El ejecutable no está firmado. Windows mostrará 'Editor desconocido'."
}

# ------------------------------------------------------------------
# 6. Crear instalador con Inno Setup
# ------------------------------------------------------------------
Step "Creando instalador con Inno Setup"
$iscc = (Get-Command iscc -ErrorAction SilentlyContinue)?.Source
if (-not $iscc) { $iscc = $env:ISCC_PATH }

if ($iscc -and (Test-Path $iscc)) {
    try {
        & $iscc /DMyAppVersion=$Version "$root\installer\Helpmeet.iss"
        if ($LASTEXITCODE -eq 0) { Pass "Instalador creado: dist\installer\Helpmeet-Setup-$Version.exe" }
        else { Fail "Inno Setup falló" }
    } catch { Fail "Error en Inno Setup: $_" }
} else {
    Warn "Inno Setup no encontrado. Instala iscc.exe y añádelo al PATH (o define ISCC_PATH)."
    Warn "Descarga: https://jrsoftware.org/isdl.php"
    Skip "Instalador no generado"
}

# ------------------------------------------------------------------
# 7. Firmar instalador (solo con -Sign)
# ------------------------------------------------------------------
Step "Firma digital del instalador"
$installerPath = "$root\dist\installer\Helpmeet-Setup-$Version.exe"
if ($Sign -and (Test-Path $installerPath)) {
    try {
        signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256 /a $installerPath
        signtool verify /pa /v $installerPath
        Pass "Instalador firmado y verificado"
    } catch { Fail "Error al firmar instalador: $_" }
} elseif ($Sign) {
    Warn "Instalador no encontrado — omitiendo firma"
} else {
    Skip "Firma omitida (usa -Sign para firmar)"
}

# ------------------------------------------------------------------
# 8. Generar SHA-256
# ------------------------------------------------------------------
Step "Generando SHA-256"
if (Test-Path $installerPath) {
    try {
        & "$root\scripts\generate_sha256.ps1" -Version $Version
        Pass "SHA256SUMS.txt generado"
    } catch { Warn "No se pudo generar SHA-256: $_" }
} else {
    Skip "Instalador no disponible — SHA-256 omitido"
}

# ------------------------------------------------------------------
# Resultado
# ------------------------------------------------------------------
Write-Host "`n" + ("=" * 60)
if ($ok) {
    Write-Host "BUILD COMPLETADO: $Version" -ForegroundColor Green
    Write-Host "  Ejecutable:  dist\Helpmeet\Helpmeet.exe"
    if (Test-Path $installerPath) {
        Write-Host "  Instalador:  dist\installer\Helpmeet-Setup-$Version.exe"
    }
    if (-not $Sign) {
        Write-Host ""
        Write-Host "  RECORDATORIO: build sin firma digital." -ForegroundColor Yellow
        Write-Host "  Usa .\scripts\build_release.ps1 -Sign para firmar." -ForegroundColor Yellow
    }
} else {
    Write-Host "BUILD FALLIDO: revisar errores arriba" -ForegroundColor Red
    exit 1
}
