# Compila el instalador de Helpmeet con Inno Setup.
# Requisitos: haber generado antes el build con scripts\build_windows.ps1
# (debe existir dist\Helpmeet\Helpmeet.exe) e Inno Setup 6 instalado.

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$Dist = Join-Path $Root "dist\Helpmeet\Helpmeet.exe"
$Iss = Join-Path $Root "installer\Helpmeet.iss"

if (-not (Test-Path -LiteralPath $Dist)) {
    throw "No existe dist\Helpmeet\Helpmeet.exe. Ejecuta primero scripts\build_windows.ps1."
}

# Versión desde helpmeet\version.py (línea __version__ = "x.y.z").
$VersionLine = Select-String -Path (Join-Path $Root "helpmeet\version.py") -Pattern '__version__\s*=\s*"([^"]+)"'
if (-not $VersionLine) { throw "No se pudo leer la versión de helpmeet\version.py." }
$Version = $VersionLine.Matches[0].Groups[1].Value
Write-Host "Versión: $Version"

# Localiza el compilador de Inno Setup (ISCC).
$Iscc = $null
$Candidates = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe"
)
foreach ($c in $Candidates) {
    if ($c -and (Test-Path -LiteralPath $c)) { $Iscc = $c; break }
}
if (-not $Iscc) {
    $cmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
    if ($cmd) { $Iscc = $cmd.Source }
}
if (-not $Iscc) {
    throw "No se encontró Inno Setup (ISCC.exe). Instálalo desde https://jrsoftware.org/isdl.php"
}

& $Iscc "/DMyAppVersion=$Version" $Iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup falló al compilar el instalador." }

Write-Host "Instalador listo en: $Root\dist\installer\Helpmeet-Setup-$Version.exe"
