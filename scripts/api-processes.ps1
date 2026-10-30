function Test-ProjectApiCommand {
    param([string]$CommandLine, [string]$ApiRoot, [string]$LauncherPath, [bool]$AppMatches)
    if (-not $CommandLine) { return $false }
    $normalized = $CommandLine.Replace('\', '/').ToLowerInvariant()
    $absoluteApi = $ApiRoot.Replace('\', '/').ToLowerInvariant()
    $absoluteLauncher = $LauncherPath.Replace('\', '/').ToLowerInvariant()
    $apiEntrypoint = $normalized -match '(?:app\.main:app|app\.cli|start-api-local\.py)'
    if (-not $apiEntrypoint) { return $false }
    if ($normalized.Contains($absoluteApi + '/') -or $normalized.Contains($absoluteLauncher)) { return $true }
    # Legacy launches used a relative --app-dir; require the actual TourSim
    # HTTP signature as well, rather than accepting any Python on port 8000.
    return $AppMatches -and $normalized -match 'app\.main:app' -and $normalized -match '--app-dir(?:\s+|=)["'']?(?:\./)?apps/api(?:["''\s]|$)'
}

function Get-ApiListenerIds {
    param([int]$Port)
    $connections = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
    if ($connections.Count) { return @($connections.OwningProcess | Sort-Object -Unique) }
    # Get-NetTCPConnection can be unavailable in a restricted PowerShell.
    foreach ($line in (& netstat.exe -ano -p tcp)) {
        if ($line -match '^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$' -and [int]$Matches[1] -eq $Port) {
            [int]$Matches[2]
        }
    }
}

function Test-NewApiListener {
    param([string]$ServerLog, [int[]]$ListenerIds, [int[]]$PreviousIds)
    $started = [regex]::Matches($ServerLog, 'Started server process \[(\d+)\]')
    if (-not $started.Count) { return $false }
    $serverId = [int]$started[$started.Count - 1].Groups[1].Value
    return $serverId -in $ListenerIds -and $serverId -notin $PreviousIds
}
