param(
  [string]$Feature = "system",
  [string]$OutputDir,
  [string]$RepoRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  param(
    [string]$ExplicitRoot,
    [string]$StartPath
  )

  if ($ExplicitRoot) {
    return (Resolve-Path $ExplicitRoot).Path
  }

  $cursor = (Resolve-Path $StartPath).Path
  while ($true) {
    $hasTurbo = Test-Path (Join-Path $cursor "turbo.json")
    $hasPlaywright = Test-Path (Join-Path $cursor ".playwright-mcp.json")
    $hasApps = Test-Path (Join-Path $cursor "apps")
    if ($hasTurbo -or ($hasPlaywright -and $hasApps)) {
      return $cursor
    }

    $parent = Split-Path -Path $cursor -Parent
    if (-not $parent -or $parent -eq $cursor) {
      throw "Could not resolve repo root from $StartPath"
    }
    $cursor = $parent
  }
}

$repoPath = Resolve-RepoRoot -ExplicitRoot $RepoRoot -StartPath $PSScriptRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not $OutputDir) {
  $OutputDir = Join-Path $repoPath ".artifacts\integration-audits\$timestamp\playwright"
}

[void][System.IO.Directory]::CreateDirectory($OutputDir)

$mcpConfigPath = Join-Path $repoPath ".playwright-mcp.json"
$flowConfigPath = Join-Path $repoPath ".playwright-fittrack-flow.json"
$reportPath = Join-Path $OutputDir "playwright-checks.md"
$preflightLogPath = Join-Path $OutputDir "preflight.log"

if (-not (Test-Path $mcpConfigPath)) {
  throw "Missing Playwright MCP config at $mcpConfigPath"
}

if (-not (Test-Path $flowConfigPath)) {
  throw "Missing flow config at $flowConfigPath"
}

$mcpConfig = Get-Content $mcpConfigPath -Raw | ConvertFrom-Json
$flowConfig = Get-Content $flowConfigPath -Raw | ConvertFrom-Json

function Test-Url {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return "reachable ($($response.StatusCode))"
  } catch {
    return "unreachable"
  }
}

$webEntry = "$($flowConfig.apps.web.baseUrl)$($flowConfig.apps.web.loginRoute)"
$mobileEntry = "$($flowConfig.apps.mobile.baseUrl)$($flowConfig.apps.mobile.loginRoute)"
$webStatus = Test-Url -Url $webEntry
$mobileStatus = Test-Url -Url $mobileEntry

$preflightPath = Join-Path $repoPath "tasks\integration-builder\integration-preflight.cmd"
if (Test-Path $preflightPath) {
  try {
    & $preflightPath -Mode runtime *>&1 | Set-Content -Path $preflightLogPath -Encoding UTF8
  } catch {
    $_ | Out-String | Set-Content -Path $preflightLogPath -Encoding UTF8
  }
}

$lines = @(
  "# Playwright Integration Check Staging",
  "",
  "- Feature: ``$Feature``",
  "- Artifact directory: ``$($OutputDir.Replace($repoPath, '.').Replace('\', '/'))``",
  "- MCP config: ``.playwright-mcp.json``",
  "- Flow config: ``.playwright-fittrack-flow.json``",
  "",
  "## Reachability",
  "",
  "- Web entry: ``$webEntry`` -> $webStatus",
  "- Mobile entry: ``$mobileEntry`` -> $mobileStatus",
  "",
  "## Required verification policy",
  "",
  "- Require web flow: ``$($flowConfig.verificationPolicy.requireWebFlow)``",
  "- Require mobile flow: ``$($flowConfig.verificationPolicy.requireMobileFlow)``",
  "- Require touched endpoint evidence: ``$($flowConfig.verificationPolicy.requireTouchedEndpointEvidence)``",
  "- Require negative path when role-sensitive: ``$($flowConfig.verificationPolicy.requireNegativePathWhenRoleSensitive)``",
  "",
  "## Completion QA verification targets",
  "",
  "- Exercise touched primary actions when feasible.",
  "- Exercise modal open, close, and submit or cancel paths when modal-driven actions exist.",
  "- Confirm a visible post-action state, not only network traffic.",
  "- Capture denial paths for role-sensitive surfaces.",
  "- Note any uncanny-but-functional UX gaps instead of treating reachability alone as success.",
  "",
  "## Runtime notes",
  "",
  "- Browser output dir from MCP config: ``$($mcpConfig.outputDir)``",
  "- Shared browser context: ``$($mcpConfig.sharedBrowserContext)``",
  "- Save trace: ``$($mcpConfig.saveTrace)``",
  "- Console capture level: ``$($mcpConfig.console.level)``",
  "",
  "## Next steps",
  "",
  "1. Confirm the touched backend services are already healthy.",
  "2. Use Playwright MCP against the configured web and mobile entry routes.",
  "3. Capture network evidence for touched endpoints.",
  "4. Capture visible post-action states, not only successful requests.",
  "5. Store verification notes beside this report and under the existing Notion integration tracker.",
  "",
  "## Preflight log",
  "",
  "- ``$($preflightLogPath.Replace($repoPath, '.').Replace('\', '/'))``"
)

$lines -join "`r`n" | Set-Content -Path $reportPath -Encoding UTF8

Write-Output "Created Playwright integration staging report: $reportPath"
