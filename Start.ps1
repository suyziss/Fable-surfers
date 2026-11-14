param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$gameDirectory = $PSScriptRoot
$gamePort = if ($env:PORT) { [int]$env:PORT } else { 43827 }
$gameAddress = "http://127.0.0.1:$gamePort"

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    throw 'Node.js 20+ was not found. Install Node.js, reopen PowerShell and try again.'
}

try {
    $health = Invoke-RestMethod -Uri "$gameAddress/health" -TimeoutSec 2
    if ($health.app -eq 'fable-surfers') {
        Write-Host "Fable Surfers is already running at $gameAddress"
        if (-not $NoBrowser) { Start-Process $gameAddress }
        exit 0
    }
} catch {}

$process = Start-Process -FilePath $node.Source -ArgumentList 'server.cjs' -WorkingDirectory $gameDirectory -WindowStyle Hidden -PassThru
Set-Content -LiteralPath (Join-Path $gameDirectory '.server.pid') -Value $process.Id

$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 200
    try {
        $health = Invoke-RestMethod -Uri "$gameAddress/health" -TimeoutSec 1
        if ($health.app -eq 'fable-surfers') { $ready = $true; break }
    } catch {}
}
if (-not $ready) {
    throw "Could not start Fable Surfers on port $gamePort. Check whether the port is already in use."
}
Write-Host "Fable Surfers is running at $gameAddress"
if (-not $NoBrowser) { Start-Process $gameAddress }
