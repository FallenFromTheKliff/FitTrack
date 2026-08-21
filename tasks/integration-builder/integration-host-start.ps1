param(
  [switch]$IncludeAi,
  [switch]$RestartManaged,
  [string]$WorkspaceRoot = $(Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "integration-host.mjs"
$arguments = @($scriptPath, "start", "--workspace-root", $WorkspaceRoot)
if ($IncludeAi) {
  $arguments += "--include-ai"
}
if ($RestartManaged) {
  $arguments += "--restart-managed"
}

& node @arguments
exit $LASTEXITCODE
