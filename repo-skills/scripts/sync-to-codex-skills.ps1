[CmdletBinding()]
param(
  [string]$RepoRoot,
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
  $scriptPath = $MyInvocation.MyCommand.Path
  if (-not $scriptPath) {
    throw 'Could not resolve the script path for sync-to-codex-skills.ps1.'
  }
  $RepoRoot = (Resolve-Path (Join-Path (Split-Path -Parent $scriptPath) '..\..')).Path
}

function Copy-OverlayFile {
  param(
    [Parameter(Mandatory = $true)][string]$SourcePath,
    [Parameter(Mandatory = $true)][string]$TargetPath,
    [switch]$DryRun
  )

  $targetDir = Split-Path -Parent $TargetPath
  if (-not (Test-Path $targetDir)) {
    if ($DryRun) {
      Write-Host "[dry-run] mkdir $targetDir"
    } else {
      New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    }
  }

  if ($DryRun) {
    Write-Host "[dry-run] copy $SourcePath -> $TargetPath"
    return
  }

  Copy-Item -Path $SourcePath -Destination $TargetPath -Force
  Write-Host "copied $SourcePath -> $TargetPath"
}

function Copy-NewSkillDirectory {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [switch]$DryRun
  )

  if ($DryRun) {
    Write-Host "[dry-run] sync $SourceDir -> $TargetDir"
    return
  }

  if (Test-Path $TargetDir) {
    Remove-Item -Recurse -Force $TargetDir
  }

  Copy-Item -Path $SourceDir -Destination $TargetDir -Recurse -Force
  Write-Host "synced $SourceDir -> $TargetDir"
}

$repoSkillsRoot = Join-Path $RepoRoot 'repo-skills'
$codexSkillsRoot = Join-Path $RepoRoot '.codex\skills'

if (-not (Test-Path $repoSkillsRoot)) {
  throw "repo-skills staging root not found at $repoSkillsRoot"
}

if (-not (Test-Path $codexSkillsRoot)) {
  throw "Live .codex/skills root not found at $codexSkillsRoot"
}

$overlayMap = @(
  @{ Source = 'core-overlays\integration\SKILL.md'; Target = '.codex\skills\integration\SKILL.md' },
  @{ Source = 'core-overlays\integration\agents\openai.yaml'; Target = '.codex\skills\integration\agents\openai.yaml' },
  @{ Source = 'core-overlays\frontend\SKILL.md'; Target = '.codex\skills\frontend\SKILL.md' },
  @{ Source = 'core-overlays\frontend\agents\openai.yaml'; Target = '.codex\skills\frontend\agents\openai.yaml' },
  @{ Source = 'core-overlays\backend\SKILL.md'; Target = '.codex\skills\backend\SKILL.md' },
  @{ Source = 'core-overlays\backend\agents\openai.yaml'; Target = '.codex\skills\backend\agents\openai.yaml' },
  @{ Source = 'core-overlays\frontend-uiux-polish\SKILL.md'; Target = '.codex\skills\frontend-uiux-polish\SKILL.md' },
  @{ Source = 'core-overlays\frontend-uiux-polish\agents\openai.yaml'; Target = '.codex\skills\frontend-uiux-polish\agents\openai.yaml' },
  @{ Source = 'core-overlays\quality-assurance\SKILL.md'; Target = '.codex\skills\quality-assurance\SKILL.md' },
  @{ Source = 'core-overlays\quality-assurance\agents\openai.yaml'; Target = '.codex\skills\quality-assurance\agents\openai.yaml' },
  @{ Source = 'core-overlays\skill-improver\SKILL.md'; Target = '.codex\skills\skill-improver\SKILL.md' },
  @{ Source = 'core-overlays\skill-improver\agents\openai.yaml'; Target = '.codex\skills\skill-improver\agents\openai.yaml' }
)

$newSkills = @(
  'brainstorm',
  'system-adapt',
  'stack-orchestration',
  'security-hardening',
  'ai-contract-core',
  'ml-pose-tuning',
  'ai-chatbot-systems',
  'business-analytics-ai',
  'premium-route-rebuild'
)

Write-Host "Syncing staged skill rollout from $repoSkillsRoot"

foreach ($entry in $overlayMap) {
  $sourcePath = Join-Path $repoSkillsRoot $entry.Source
  $targetPath = Join-Path $RepoRoot $entry.Target
  if (-not (Test-Path $sourcePath)) {
    throw "Missing overlay source: $sourcePath"
  }
  Copy-OverlayFile -SourcePath $sourcePath -TargetPath $targetPath -DryRun:$DryRun
}

foreach ($skillName in $newSkills) {
  $sourceDir = Join-Path $repoSkillsRoot ("new-skills\" + $skillName)
  $targetDir = Join-Path $codexSkillsRoot $skillName
  if (-not (Test-Path $sourceDir)) {
    throw "Missing new skill source: $sourceDir"
  }
  Copy-NewSkillDirectory -SourceDir $sourceDir -TargetDir $targetDir -DryRun:$DryRun
}

Write-Host 'Skill sync complete.'
