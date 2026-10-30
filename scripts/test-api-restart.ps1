$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'api-processes.ps1')
$apiRoot = 'D:\esim\esim-platform\apps\api'
$launcher = 'D:\esim\start-api-local.py'
$cases = @(
    @{ Name = 'absolute launcher'; Command = 'python.exe D:\esim\start-api-local.py'; App = $false; Expected = $true },
    @{ Name = 'venv launch'; Command = 'D:\esim\esim-platform\apps\api\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir apps/api'; App = $false; Expected = $true },
    @{ Name = 'legacy relative path'; Command = 'python.exe -m uvicorn app.main:app --app-dir apps/api --port 8000'; App = $true; Expected = $true },
    @{ Name = 'legacy quoted path'; Command = 'python.exe -m uvicorn app.main:app --app-dir ".\apps\api"'; App = $true; Expected = $true },
    @{ Name = 'foreign API with same module'; Command = 'python.exe -m uvicorn app.main:app --app-dir apps/api'; App = $false; Expected = $false },
    @{ Name = 'foreign directory'; Command = 'python.exe -m uvicorn app.main:app --app-dir apps/api-other'; App = $true; Expected = $false },
    @{ Name = 'unrelated Python inside repo'; Command = 'D:\esim\esim-platform\apps\api\.venv\Scripts\python.exe unrelated.py'; App = $true; Expected = $false },
    @{ Name = 'unreadable process'; Command = ''; App = $true; Expected = $false }
)
foreach ($case in $cases) {
    $actual = Test-ProjectApiCommand -CommandLine $case.Command -ApiRoot $apiRoot -LauncherPath $launcher -AppMatches $case.App
    if ($actual -ne $case.Expected) { throw "Process identity failed: $($case.Name)" }
}
if (Test-NewApiListener -ServerLog '' -ListenerIds @(1536) -PreviousIds @(1536)) { throw 'Old health cannot prove startup.' }
if (Test-NewApiListener -ServerLog 'Started server process [2000]' -ListenerIds @(1536) -PreviousIds @(1536)) { throw 'Old listener cannot prove startup.' }
if (Test-NewApiListener -ServerLog 'Started server process [1536]' -ListenerIds @(1536) -PreviousIds @(1536)) { throw 'Old server log cannot prove startup.' }
if (-not (Test-NewApiListener -ServerLog 'Started server process [2000]' -ListenerIds @(2000) -PreviousIds @(1536))) { throw 'New listener should pass.' }
Write-Host '12 API restart identity and startup checks passed. No processes were stopped.'
