$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonPath = Join-Path $projectRoot 'apps/api/.venv/Scripts/python.exe'
$logRoot = Join-Path (Split-Path -Parent $projectRoot) '.run'
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$logPath = Join-Path $logRoot 'auth-check.log'
Start-Transcript -Path $logPath -Force | Out-Null
try {
    Push-Location $projectRoot
    try {
        $secureStore = Join-Path $projectRoot 'apps/mobile/node_modules/expo-secure-store/package.json'
        if (-not (Test-Path -LiteralPath $secureStore)) {
            & npm.cmd install --prefix apps/mobile 'expo-secure-store@~57.0.4'
            if ($LASTEXITCODE -ne 0) { throw 'SecureStore installation failed' }
        }
        & $pythonPath -m pytest apps/api/tests -q
        if ($LASTEXITCODE -ne 0) { throw 'API tests failed' }
        & $pythonPath apps/api/scripts/export_contracts.py
        if ($LASTEXITCODE -ne 0) { throw 'Contract export failed' }
        & npm.cmd run typecheck
        if ($LASTEXITCODE -ne 0) { throw 'TypeScript check failed' }
        Write-Host 'Authentication checks passed. No real emails were sent by the tests.'
    } finally { Pop-Location }
} finally { Stop-Transcript | Out-Null }
Write-Host "Results: $logPath"
