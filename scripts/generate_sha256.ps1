# generate_sha256.ps1 — Genera SHA256SUMS.txt para el instalador firmado.
# Ejecutar DESPUÉS de firmar el instalador.
# Uso: .\scripts\generate_sha256.ps1

param(
    [string]$Version = ""
)

$root = Split-Path $PSScriptRoot -Parent

if (-not $Version) {
    # Leer versión de helpmeet/version.py
    $versionFile = "$root\helpmeet\version.py"
    if (Test-Path $versionFile) {
        $line = Get-Content $versionFile | Where-Object { $_ -match '__version__' }
        if ($line -match '"([^"]+)"') { $Version = $Matches[1] }
    }
}

if (-not $Version) { $Version = "0.0.0" }

$installerPath = "$root\dist\installer\Helpmeet-Setup-$Version.exe"
$outputPath    = "$root\dist\installer\SHA256SUMS.txt"

if (-not (Test-Path $installerPath)) {
    Write-Host "ERROR: No se encontró $installerPath" -ForegroundColor Red
    exit 1
}

$hash = (Get-FileHash $installerPath -Algorithm SHA256).Hash.ToLower()
$filename = [System.IO.Path]::GetFileName($installerPath)

"$hash  $filename" | Out-File -FilePath $outputPath -Encoding utf8
Write-Host "SHA-256 generado:" -ForegroundColor Green
Write-Host "  $hash  $filename"
Write-Host "  Guardado en: $outputPath"
Write-Host ""
Write-Host "Verificar con:"
Write-Host "  Get-FileHash '.\$filename' -Algorithm SHA256"
