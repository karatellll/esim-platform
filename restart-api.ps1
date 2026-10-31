$ErrorActionPreference = 'Stop'
$projectRoot = Join-Path $PSScriptRoot 'esim-platform'
$apiRoot = Join-Path $projectRoot 'apps/api'
$launcherPath = Join-Path $PSScriptRoot 'start-api-local.py'
$port = 8000
. (Join-Path $projectRoot 'scripts/api-processes.ps1')

# Resolve a working interpreter before stopping anything.
$pythonPath = $null
foreach ($candidate in @((Join-Path $apiRoot '.venv/Scripts/python.exe'), 'C:\Program Files\PostgreSQL\17\pgAdmin 4\python\python.exe')) {
    if (-not (Test-Path -LiteralPath $candidate)) { continue }
    try {
        $versionText = & $candidate --version 2>&1
        if ($LASTEXITCODE -eq 0) { $pythonPath = $candidate; break }
    } catch { }
}
if (-not $pythonPath) { throw 'A working Python interpreter was not found. The API was not stopped.' }

# A sandboxed/offline restart must not replace the working server with one
# that cannot reach the provider. This also checks provider keys and imports.
Write-Host 'Checking provider access before restart...'
& $pythonPath $launcherPath --check-provider
if ($LASTEXITCODE -ne 0) { throw 'Provider preflight failed. The running API has not been changed.' }

$previousIds = @(Get-ApiListenerIds -Port $port)
$appMatches = $false
if ($previousIds.Count) {
    try {
        $reply = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$port/openapi.json" -TimeoutSec 5
        $spec = [Text.Encoding]::UTF8.GetString($reply.RawContentStream.ToArray()) | ConvertFrom-Json
        $title = ([char[]]@(0x422, 0x443, 0x440, 0x421, 0x438, 0x43C) -join '') + ' API'
        $appMatches = $spec.info.title -eq $title -and $null -ne $spec.paths.PSObject.Properties['/api/catalog/categories'] -and $null -ne $spec.paths.PSObject.Properties['/api/auth/refresh']
    } catch { }
}

$toStop = @{}
foreach ($serverPid in $previousIds) {
    $chain = @()
    $currentId = $serverPid
    for ($depth = 0; $depth -lt 5; $depth++) {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $currentId" -ErrorAction Stop
        if (-not $processInfo -or $processInfo.Name -notmatch '^python(?:w)?\.exe$') { break }
        if ($chain.Count -and $processInfo.CreationDate -gt $chain[-1].CreationDate) { break }
        $chain += $processInfo
        $currentId = [int]$processInfo.ParentProcessId
    }
    $ownerIndex = -1
    for ($index = 0; $index -lt $chain.Count; $index++) {
        if (Test-ProjectApiCommand -CommandLine $chain[$index].CommandLine -ApiRoot $apiRoot -LauncherPath $launcherPath -AppMatches $appMatches) { $ownerIndex = $index }
    }
    if ($ownerIndex -lt 0) { throw "Port $port belongs to an unverified process ($serverPid). It was not stopped." }
    # Stop verified launchers/reloaders before their child server.
    for ($index = $ownerIndex; $index -ge 0; $index--) { $toStop[[int]$chain[$index].ProcessId] = $chain[$index] }
}
foreach ($entry in @($toStop.Values | Sort-Object CreationDate)) {
    $current = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.ProcessId)" -ErrorAction Stop
    if (-not $current) { continue }
    if ($current.CreationDate -ne $entry.CreationDate) { throw "PID $($entry.ProcessId) was reused. It was not stopped." }
    Stop-Process -Id $entry.ProcessId -Force -Confirm:$false -ErrorAction Stop
    Wait-Process -Id $entry.ProcessId -Timeout 5 -ErrorAction SilentlyContinue
}
for ($attempt = 0; $attempt -lt 30 -and @(Get-ApiListenerIds -Port $port).Count; $attempt++) { Start-Sleep -Milliseconds 200 }
if (@(Get-ApiListenerIds -Port $port).Count) { throw "Port $port was not released. No new API was launched." }

$runDirectory = Join-Path $PSScriptRoot '.run'
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
$runId = [guid]::NewGuid().ToString('N')
$stdoutLog = Join-Path $runDirectory "api-$runId.stdout.log"
$stderrLog = Join-Path $runDirectory "api-$runId.stderr.log"
# Always pass the absolute launcher path, including with the venv interpreter.
$apiProcess = Start-Process -FilePath $pythonPath -ArgumentList ('"' + $launcherPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru
$ready = $false
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $serverLog = if (Test-Path -LiteralPath $stderrLog) { [string](Get-Content -Raw -LiteralPath $stderrLog) } else { '' }
    $listenerIds = @(Get-ApiListenerIds -Port $port)
    if (Test-NewApiListener -ServerLog $serverLog -ListenerIds $listenerIds -PreviousIds $previousIds) {
        try {
            $health = Invoke-RestMethod -Uri "http://localhost:$port/health" -TimeoutSec 2
            $loadedSpec = Invoke-RestMethod -Uri "http://localhost:$port/openapi.json" -TimeoutSec 2
            $hasOrders = $null -ne $loadedSpec.paths.PSObject.Properties['/api/orders'] -and $null -ne $loadedSpec.paths.PSObject.Properties['/api/checkout/summary']
            if ($health.status -eq 'ok' -and $hasOrders) { $ready = $true; break }
        } catch { }
    }
    $apiProcess.Refresh()
    if ($apiProcess.HasExited -and -not $listenerIds.Count) { throw "API process exited before startup. See $stderrLog" }
    Start-Sleep -Milliseconds 250
}
if (-not $ready) { throw "The new API did not pass startup checks. See $stderrLog" }

$catalog = Invoke-RestMethod -Uri "http://localhost:$port/api/catalog/categories" -TimeoutSec 65
$items = @($catalog.data | ForEach-Object { $_.esims }).Count
Write-Host "Catalog OK: $(@($catalog.data).Count) categories, $items items."
Write-Host 'Order routes OK. Reload http://localhost:8081'
Write-Host "API listener PID: $($listenerIds -join ', ')"
Write-Host "Logs: $stderrLog"
