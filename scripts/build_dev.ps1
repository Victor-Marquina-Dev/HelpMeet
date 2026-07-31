# build_dev.ps1 - Build rapido de desarrollo (sin tests, sin Inno Setup).
# Uso: .\scripts\build_dev.ps1
#
# Solo compila con PyInstaller y copia el .exe a recursos/v{version}/
# para pruebas locales rapidas. No valida, no firma, no genera instalador.
#
# Requisito: .venv con PyInstaller instalado (pip install pyinstaller)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

# Detectar version desde helpmeet/version.py
$vf = "$root\helpmeet\version.py"
$Version = "0.0.0"
if (Test-Path $vf) {
    $line = Get-Content $vf | Where-Object { $_ -match '__version__' }
    if ($line -match '"([^"]+)"') { $Version = $Matches[1] }
}

Write-Host "Helpmeet Dev Build v$Version" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# 1. Limpiar build anterior
Write-Host "==> Limpiando build anterior..." -ForegroundColor Yellow
@("$root\dist\Helpmeet", "$root\build") | ForEach-Object {
    if (Test-Path $_) {
        Remove-Item $_ -Recurse -Force
        Write-Host "  OK  Eliminado: $_" -ForegroundColor Green
    }
}

# 2. Compilar con PyInstaller
Write-Host "`n==> Compilando con PyInstaller..." -ForegroundColor Yellow
Push-Location $root
try {
    & ".\.venv\Scripts\python.exe" -m PyInstaller Helpmeet.spec --noconfirm
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL PyInstaller fallo (exit $LASTEXITCODE)" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Write-Host "  OK  dist\Helpmeet\Helpmeet.exe generado" -ForegroundColor Green
} finally {
    Pop-Location
}

# 3. Copiar a recursos/v{version}/
$recursosDir = "$root\recursos\v$Version"
Write-Host "`n==> Copiando a $recursosDir ..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $recursosDir | Out-Null
Copy-Item -Recurse -Force "$root\dist\Helpmeet\*" "$recursosDir\"
Write-Host "  OK  Ejecutable copiado a recursos\v$Version\" -ForegroundColor Green

# 4. Resumen
Write-Host "`n================================`n" -ForegroundColor Cyan
Write-Host "Build completado. Ejecutable listo en:" -ForegroundColor White
Write-Host "  $recursosDir\Helpmeet.exe" -ForegroundColor Green
Write-Host "`nPara generar el instalador completo: .\scripts\build_release.ps1 -Version `"$Version`"" -ForegroundColor Gray
