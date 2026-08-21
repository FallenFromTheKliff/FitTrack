[CmdletBinding()]
param(
  [string]$RepoRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
  $scriptPath = $MyInvocation.MyCommand.Path
  if (-not $scriptPath) {
    throw 'Could not resolve the script path for validate-staged-skills.ps1.'
  }
  $RepoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $scriptPath) '..\..')).Path
}

$targets = @(
  @{ Path='repo-skills/core-overlays/integration'; RequireExamples=$false; RequireReferences=$false },
  @{ Path='repo-skills/core-overlays/frontend'; RequireExamples=$false; RequireReferences=$false },
  @{ Path='repo-skills/core-overlays/backend'; RequireExamples=$false; RequireReferences=$false },
  @{ Path='repo-skills/core-overlays/frontend-uiux-polish'; RequireExamples=$false; RequireReferences=$false },
  @{ Path='repo-skills/core-overlays/quality-assurance'; RequireExamples=$false; RequireReferences=$false },
  @{ Path='repo-skills/core-overlays/skill-improver'; RequireExamples=$false; RequireReferences=$false },
  @{ Path='repo-skills/new-skills/brainstorm'; RequireExamples=$true; RequireReferences=$true },
  @{ Path='repo-skills/new-skills/system-adapt'; RequireExamples=$true; RequireReferences=$true },
  @{ Path='repo-skills/new-skills/stack-orchestration'; RequireExamples=$true; RequireReferences=$true },
  @{ Path='repo-skills/new-skills/security-hardening'; RequireExamples=$true; RequireReferences=$true },
  @{ Path='repo-skills/new-skills/ai-contract-core'; RequireExamples=$true; RequireReferences=$true },
  @{ Path='repo-skills/new-skills/ml-pose-tuning'; RequireExamples=$true; RequireReferences=$true },
  @{ Path='repo-skills/new-skills/ai-chatbot-systems'; RequireExamples=$true; RequireReferences=$true },
  @{ Path='repo-skills/new-skills/business-analytics-ai'; RequireExamples=$true; RequireReferences=$true }
)

$failed = $false

foreach ($target in $targets) {
  $skillPath = Join-Path $RepoRoot $target.Path
  $skillFile = Join-Path $skillPath 'SKILL.md'

  if (-not (Test-Path $skillFile)) {
    Write-Host "Missing SKILL.md: $($target.Path)"
    $failed = $true
    continue
  }

  $content = Get-Content $skillFile -Raw
  if ($content -notmatch '(?s)^---\s*\r?\nname:\s*.+\r?\ndescription:\s*.+\r?\n---') {
    Write-Host "Invalid frontmatter: $($target.Path)"
    $failed = $true
  }

  $agentFile = Join-Path $skillPath 'agents\openai.yaml'
  if (-not (Test-Path $agentFile)) {
    Write-Host "Missing agent metadata: $($target.Path)"
    $failed = $true
  }

  if ($target.RequireReferences) {
    $referenceFiles = Get-ChildItem (Join-Path $skillPath 'references') -File -ErrorAction SilentlyContinue
    if (-not $referenceFiles) {
      Write-Host "Missing references: $($target.Path)"
      $failed = $true
    }
  }

  if ($target.RequireExamples) {
    if (-not (Test-Path (Join-Path $skillPath 'examples\good-outputs.md'))) {
      Write-Host "Missing good examples: $($target.Path)"
      $failed = $true
    }
    if (-not (Test-Path (Join-Path $skillPath 'examples\bad-outputs.md'))) {
      Write-Host "Missing bad examples: $($target.Path)"
      $failed = $true
    }
  }
}

if ($failed) {
  throw 'Staged skill validation failed.'
}

Write-Host 'Repo-local staged skill structure validation passed.'
