# check_all.ps1 — Validación local completa de Helpmeet
# Ejecutar antes de compilar o publicar.
# Uso: .\scripts\check_all.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$ok = $true

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Pass($msg) { Write-Host "  OK  $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  FAIL $msg" -ForegroundColor Red; $script:ok = $false }

# 1. Tests app principal
Step "Tests app principal"
try {
    Push-Location $root
    & ".\.venv\Scripts\python.exe" -m pytest tests -q --tb=short 2>&1 | Tee-Object -Variable out
    if ($LASTEXITCODE -eq 0) { Pass "App tests pasaron" } else { Fail "App tests fallaron" }
} catch { Fail "No se pudo ejecutar app tests: $_" }
finally { Pop-Location }

# 2. Tests backend licencias
Step "Tests backend licencias"
try {
    Push-Location "$root\helpmeet-licenses"
    & ".\.venv\Scripts\python.exe" -m pytest -q --tb=short 2>&1 | Tee-Object -Variable out
    if ($LASTEXITCODE -eq 0) { Pass "Licencias tests pasaron" } else { Fail "Licencias tests fallaron" }
} catch { Fail "No se pudo ejecutar licencias tests: $_" }
finally { Pop-Location }

# 3. Compilación JS (node --check)
Step "Sintaxis JavaScript"
try {
    $jsFile = "$root\helpmeet\ui\web\app.js"
    & node --check $jsFile 2>&1
    if ($LASTEXITCODE -eq 0) { Pass "app.js sin errores de sintaxis" } else { Fail "app.js tiene errores de sintaxis" }
} catch { Write-Host "  SKIP node no disponible" -ForegroundColor Yellow }

# 4. py_compile módulos clave
Step "Compilación Python módulos clave"
$pyModules = @(
    "helpmeet\ui\app.py",
    "helpmeet\settings.py",
    "helpmeet\session\recorder.py",
    "helpmeet\transcription\engine.py"
)
foreach ($mod in $pyModules) {
    try {
        $full = "$root\$mod"
        & ".\.venv\Scripts\python.exe" -m py_compile $full 2>&1
        if ($LASTEXITCODE -eq 0) { Pass $mod } else { Fail "$mod tiene errores de sintaxis" }
    } catch { Fail "No se pudo compilar: $mod" }
}

# 5. Verificar archivos temporales no deseados
Step "Archivos temporales"
$tempPatterns = @("*.db", "*.log", "*_debug.txt", "*_error.txt")
$found = @()
foreach ($pat in $tempPatterns) {
    $files = Get-ChildItem -Path $root -Recurse -Filter $pat -Exclude ".venv" -ErrorAction SilentlyContinue |
             Where-Object { $_.FullName -notlike "*\.venv\*" -and $_.FullName -notlike "*\__pycache__\*" }
    $found += $files
}
if ($found.Count -eq 0) {
    Pass "Sin archivos temporales encontrados"
} else {
    Write-Host "  WARN Archivos temporales encontrados (no bloqueante):" -ForegroundColor Yellow
    $found | ForEach-Object { Write-Host "       $($_.FullName)" -ForegroundColor Yellow }
}

# Resultado final
Write-Host "`n" + ("=" * 50)
if ($ok) {
    Write-Host "VALIDACION COMPLETA: TODO OK" -ForegroundColor Green
    exit 0
} else {
    Write-Host "VALIDACION FALLIDA: revisar errores arriba" -ForegroundColor Red
    exit 1
}
