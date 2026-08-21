param(
  [string]$ConfigPath,
  [switch]$Global
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\\..")

if ($ConfigPath) {
  $configPath = $ConfigPath
} elseif ($Global) {
  $configPath = Join-Path $env:USERPROFILE ".codex\\config.toml"
} else {
  $configPath = Join-Path $repoRoot ".codex\\config.toml"
}

if (-not (Test-Path $configPath)) {
  throw "Could not find Codex config at $configPath"
}

$content = (Get-Content $configPath -Raw) -replace "`r`n", "`n"
$newline = "`n"
$repoRootEscaped = $repoRoot.Path.Replace("\", "\\")
$npmCachePathEscaped = (Join-Path $repoRoot.Path ".npm-cache").Replace("\", "\\")

$chromeBlock = @"
[mcp_servers.chromeDevtools]
command = "cmd"
args = [
  "/c",
  "npx",
  "-y",
  "chrome-devtools-mcp@latest",
  "--headless",
  "--isolated",
]
cwd = "$repoRootEscaped"
startup_timeout_sec = 45
tool_timeout_sec = 180

[mcp_servers.chromeDevtools.env]
SystemRoot = "C:\\Windows"
PROGRAMFILES = "C:\\Program Files"
npm_config_cache = "$npmCachePathEscaped"
CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS = "1"
"@

$postgresBlock = @"
[mcp_servers.postgresReadOnly]
command = "cmd"
args = [
  "/c",
  "npx",
  "-y",
  "@modelcontextprotocol/server-postgres",
  "%FITTRACK_POSTGRES_URL%",
]
cwd = "$repoRootEscaped"
startup_timeout_sec = 45
tool_timeout_sec = 120

[mcp_servers.postgresReadOnly.env]
FITTRACK_POSTGRES_URL = "postgresql://postgres:postgres@localhost:5433/fittrackdb"
npm_config_cache = "$npmCachePathEscaped"
"@

$sentryBlock = @"
[mcp_servers.sentry]
url = "https://mcp.sentry.dev/mcp"
"@

function Add-BlockAfterRegex {
  param(
    [string]$Text,
    [string]$Pattern,
    [string]$Block,
    [string]$Marker
  )

  if ($Text.Contains($Marker)) {
    $escapedMarker = [regex]::Escape($Marker)
    $serverName = $Marker -replace '^\[mcp_servers\.', '' -replace '\]$', ''
    $escapedServerName = [regex]::Escape($serverName)
    $replacePattern = "(?ms)\n?$escapedMarker.*?(?=\n\[mcp_servers\.(?!$escapedServerName(?:\.|\]))|\z)"
    $replacement = if ($Text.Contains("`r`n")) { "`r`n$Block`r`n" } else { "`n$Block`n" }
    return [regex]::Replace($Text, $replacePattern, $replacement, 1)
  }

  $match = [regex]::Match($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if (-not $match.Success) {
    throw "Anchor not found for $Marker"
  }

  $anchorText = $match.Value
  return $Text.Remove($match.Index, $match.Length).Insert($match.Index, "$anchorText$newline$newline$Block")
}

$playwrightPattern = '\[mcp_servers\.playwright\.env\]\nPLAYWRIGHT_BROWSERS_PATH = "0"'
$prismaPattern = '\[mcp_servers\.prismaLocal\.tools\.migrate-(?:reset|dev)\]\napproval_mode = "approve"'
$figmaPattern = '\[mcp_servers\.figma\]\nurl = "https://mcp\.figma\.com/mcp"'

$content = Add-BlockAfterRegex `
  -Text $content `
  -Pattern $playwrightPattern `
  -Block $chromeBlock `
  -Marker "[mcp_servers.chromeDevtools]"

$content = Add-BlockAfterRegex `
  -Text $content `
  -Pattern $prismaPattern `
  -Block $postgresBlock `
  -Marker "[mcp_servers.postgresReadOnly]"

$content = Add-BlockAfterRegex `
  -Text $content `
  -Pattern $figmaPattern `
  -Block $sentryBlock `
  -Marker "[mcp_servers.sentry]"

Set-Content -Path $configPath -Value $content

Write-Host "Batch 3 MCP config applied to $configPath"
Write-Host "Configured entries:"
Write-Host " - chromeDevtools"
Write-Host " - postgresReadOnly"
Write-Host " - sentry"
