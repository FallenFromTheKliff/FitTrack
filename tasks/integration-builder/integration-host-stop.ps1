param(
  [string]$WorkspaceRoot = $(Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "integration-host.mjs"
& node $scriptPath "stop" "--workspace-root" $WorkspaceRoot
exit $LASTEXITCODE
