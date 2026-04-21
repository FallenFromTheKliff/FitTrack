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
  $OutputDir = Join-Path $repoPath ".artifacts\integration-audits\$timestamp"
}

[void][System.IO.Directory]::CreateDirectory($OutputDir)
$reportPath = Join-Path $OutputDir "gap-report.md"

$ignoreFragments = @(
  "\.artifacts\",
  "\apps\mobile\dist-web-auth-check\",
  "\apps\web\.next\",
  "\apps\mobile\.expo\",
  "\node_modules\",
  "\dist\"
)

$featureRegex = if ($Feature -and $Feature -ne "system") {
  [regex]::Escape($Feature)
} else {
  $null
}

function Get-CandidateFiles {
  param(
    [string[]]$Roots,
    [string[]]$IncludeExtensions
  )

  $items = @(foreach ($root in $Roots) {
    if (Test-Path $root) {
      Get-ChildItem -Path $root -Recurse -File | Where-Object {
        $full = $_.FullName
        $ignored = $false
        foreach ($fragment in $ignoreFragments) {
          if ($full.IndexOf($fragment, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $ignored = $true
            break
          }
        }
        if ($ignored) {
          return $false
        }
        if ($IncludeExtensions.Count -gt 0 -and $IncludeExtensions -notcontains $_.Extension) {
          return $false
        }
        if (-not $featureRegex) {
          return $true
        }
        if ($full -match $featureRegex) {
          return $true
        }
        try {
          return Select-String -Path $full -Pattern $featureRegex -Quiet
        } catch {
          return $false
        }
      }
    }
  })

  return @($items |
    Sort-Object FullName -Unique |
    ForEach-Object {
      $_.FullName.Replace($repoPath, ".").Replace("\", "/")
    })
}

$backendFiles = @(Get-CandidateFiles -Roots @(
  (Join-Path $repoPath "apps\api\src")
) -IncludeExtensions @(".ts"))

$webFiles = @(Get-CandidateFiles -Roots @(
  (Join-Path $repoPath "apps\web\app"),
  (Join-Path $repoPath "apps\web\hooks"),
  (Join-Path $repoPath "apps\web\components"),
  (Join-Path $repoPath "apps\web\contexts")
) -IncludeExtensions @(".ts", ".tsx"))

$mobileFiles = @(Get-CandidateFiles -Roots @(
  (Join-Path $repoPath "apps\mobile\app"),
  (Join-Path $repoPath "apps\mobile\hooks"),
  (Join-Path $repoPath "apps\mobile\components"),
  (Join-Path $repoPath "apps\mobile\contexts")
) -IncludeExtensions @(".ts", ".tsx"))

$sharedFiles = @(Get-CandidateFiles -Roots @(
  (Join-Path $repoPath "packages\api-client"),
  (Join-Path $repoPath "packages\query"),
  (Join-Path $repoPath "packages\app-core"),
  (Join-Path $repoPath "packages\types"),
  (Join-Path $repoPath "packages\validators")
) -IncludeExtensions @(".ts", ".tsx"))

$lines = @(
  "# Integration Gap Report",
  "",
  "## Scope",
  "",
  "- Feature: ``$Feature``",
  "- Artifact directory: ``$($OutputDir.Replace($repoPath, '.').Replace('\', '/'))``",
  "- Repo root: ``$repoPath``",
  "",
  "## Candidate Backend Files",
  ""
)

if ($backendFiles.Count -eq 0) {
  $lines += "- None discovered for the current filter."
} else {
  $lines += $backendFiles | ForEach-Object { "- ``$_``" }
}

$lines += @(
  "",
  "## Candidate Web Files",
  ""
)

if ($webFiles.Count -eq 0) {
  $lines += "- None discovered for the current filter."
} else {
  $lines += $webFiles | ForEach-Object { "- ``$_``" }
}

$lines += @(
  "",
  "## Candidate Mobile Files",
  ""
)

if ($mobileFiles.Count -eq 0) {
  $lines += "- None discovered for the current filter."
} else {
  $lines += $mobileFiles | ForEach-Object { "- ``$_``" }
}

$lines += @(
  "",
  "## Candidate Shared Bridge Files",
  ""
)

if ($sharedFiles.Count -eq 0) {
  $lines += "- None discovered for the current filter."
} else {
  $lines += $sharedFiles | ForEach-Object { "- ``$_``" }
}

$lines += @(
  "",
  "## Path mismatches",
  "",
  "- [ ] Frontend path does not exist in backend",
  "- [ ] Backend route has no frontend consumer",
  "",
  "## Field mismatches",
  "",
  "- [ ] Request field mismatch",
  "- [ ] Response field mismatch",
  "- [ ] Type mismatch",
  "- [ ] Casing mismatch",
  "",
  "## Feature gaps",
  "",
  "- [ ] UI exists without endpoint",
  "- [ ] Endpoint exists without UI consumer",
  "",
  "## Response-handling gaps",
  "",
  "- [ ] Missing loading state",
  "- [ ] Missing empty state",
  "- [ ] Missing error-state handling",
  "- [ ] Pagination ignored",
  "",
  "## Auth gaps",
  "",
  "- [ ] Missing token attachment",
  "- [ ] Missing 401 or 403 handling",
  "- [ ] Missing backend guard or role protection",
  "",
  "## Page Completion QA",
  "",
  "- [ ] Affordance gaps",
  "- [ ] Flow gaps",
  "- [ ] Data usability gaps",
  "- [ ] Async state gaps",
  "- [ ] Contract-to-UI gaps",
  "- [ ] Parity gaps",
  "",
  "## Finding classification",
  "",
  "- Autofix now:",
  "- Blocked external:",
  "- Blocked hard:",
  "- Product follow-up:",
  "",
  "## Autofix-now checklist",
  "",
  "- [ ] Visible primary actions",
  "- [ ] Modal triggers",
  "- [ ] Sort and filter behavior",
  "- [ ] Loading, empty, error, and pending states",
  "- [ ] Role-sensitive UI handling",
  "",
  "## Recommended product follow-ups",
  "",
  "- None yet.",
  "",
  "## Fix plan",
  "",
  "- Frontend changes:",
  "- Backend changes:",
  "- Shared transport or query changes:",
  "- Verification requirements:",
  "",
  "## Verification evidence",
  "",
  "- Direct API checks:",
  "- Web Playwright:",
  "- Mobile Playwright:",
  "- Remaining blockers:"
)

$lines -join "`r`n" | Set-Content -Path $reportPath -Encoding UTF8

Write-Output "Created integration audit seed: $reportPath"
