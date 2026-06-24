$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Python = Join-Path $Root ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $Python)) {
    throw "No se encontró .venv. Crea el entorno virtual antes de compilar."
}

Push-Location $Root
try {
    & $Python -m pytest -q
    if ($LASTEXITCODE -ne 0) { throw "Las pruebas fallaron; se canceló el build." }

    & $Python -m PyInstaller --clean --noconfirm Helpmeet.spec
    if ($LASTEXITCODE -ne 0) { throw "PyInstaller no pudo generar Helpmeet." }

    Write-Host "Build listo: $Root\dist\Helpmeet\Helpmeet.exe"
} finally {
    Pop-Location
}
