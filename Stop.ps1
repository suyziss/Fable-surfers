$ErrorActionPreference = 'SilentlyContinue'
$pidFile = Join-Path $PSScriptRoot '.server.pid'
if (-not (Test-Path $pidFile)) {
    Write-Host 'No saved Fable Surfers process ID. If the server runs in a terminal, press Ctrl+C there.'
    exit 0
}
$serverPid = [int](Get-Content -LiteralPath $pidFile -Raw)
$process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
if ($process) {
    Stop-Process -Id $serverPid -Force
    Write-Host 'Fable Surfers server stopped.'
} else {
    Write-Host 'The saved server process is not running.'
}
Remove-Item -LiteralPath $pidFile -Force
