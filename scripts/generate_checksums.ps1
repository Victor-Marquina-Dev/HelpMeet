# Genera el SHA-256 de los artefactos de distribución (instalador y/o ejecutable)
# y los escribe en dist\SHA256SUMS.txt, para que quien descargue pueda verificar
# que el archivo no se ha alterado.
#
# Verificación por parte del usuario (PowerShell):
#   Get-FileHash .\Helpmeet-Setup-0.1.0.exe -Algorithm SHA256

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root "dist"

$candidates = @()
$installerDir = Join-Path $Dist "installer"
if (Test-Path -LiteralPath $installerDir) {
    $candidates += Get-ChildItem -LiteralPath $installerDir -Filter "*.exe" -File
}
$exe = Join-Path $Dist "Helpmeet\Helpmeet.exe"
if (Test-Path -LiteralPath $exe) { $candidates += Get-Item -LiteralPath $exe }

if ($candidates.Count -eq 0) {
    throw "No hay artefactos en dist\. Genera el build (build_windows.ps1) o el instalador (build_installer.ps1) primero."
}

$lines = foreach ($file in $candidates) {
    $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower()
    Write-Host "$hash  $($file.Name)"
    "$hash  $($file.Name)"
}

$outFile = Join-Path $Dist "SHA256SUMS.txt"
$lines | Out-File -FilePath $outFile -Encoding utf8
Write-Host ""
Write-Host "SHA-256 escritos en: $outFile"
