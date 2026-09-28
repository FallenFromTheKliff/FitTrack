param(
  [string]$SourceRoot = "temp_skill_build\.codex\skills",
  [string]$DestinationRoot = ".codex\skills",
  [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-RepoRoot {
  param([string]$StartPath)

  $cursor = (Resolve-Path $StartPath).Path
  while ($true) {
    $hasTurbo = Test-Path (Join-Path $cursor "turbo.json")
    $hasCodexConfig = Test-Path (Join-Path $cursor ".codex\config.toml")
    if ($hasTurbo -or $hasCodexConfig) {
      return $cursor
    }

    $parent = Split-Path -Path $cursor -Parent
    if (-not $parent -or $parent -eq $cursor) {
      throw "Could not resolve repo root from $StartPath"
    }

    $cursor = $parent
  }
}

function Assert-SkillShape {
  param([string]$SkillDir)

  $requiredPaths = @(
    (Join-Path $SkillDir "SKILL.md"),
    (Join-Path $SkillDir "agents\openai.yaml")
  )

  foreach ($requiredPath in $requiredPaths) {
    if (-not (Test-Path $requiredPath)) {
      throw "Missing required skill file: $requiredPath"
    }
  }
}

function Get-StagedSkillNames {
  param([string]$SourceRoot)

  $skillNames = @()
  $candidateDirs = Get-ChildItem -Path $SourceRoot -Directory | Sort-Object Name

  foreach ($candidateDir in $candidateDirs) {
    $skillDir = $candidateDir.FullName
    $hasSkillMarkdown = Test-Path (Join-Path $skillDir "SKILL.md")
    $hasAgentConfig = Test-Path (Join-Path $skillDir "agents\openai.yaml")
    if ($hasSkillMarkdown -and $hasAgentConfig) {
      $skillNames += $candidateDir.Name
    }
  }

  return $skillNames
}

$repoRoot = Resolve-RepoRoot -StartPath $PSScriptRoot
$resolvedSourceRoot = (Resolve-Path (Join-Path $repoRoot $SourceRoot)).Path
$resolvedDestinationRoot = Join-Path $repoRoot $DestinationRoot
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $repoRoot ".artifacts\skill-installer\$timestamp"
$skillNames = @(Get-StagedSkillNames -SourceRoot $resolvedSourceRoot)

if ($skillNames.Count -eq 0) {
  throw "No staged skill directories with SKILL.md and agents/openai.yaml were found under $resolvedSourceRoot"
}

foreach ($skillName in $skillNames) {
  $sourceSkillDir = Join-Path $resolvedSourceRoot $skillName
  if (-not (Test-Path $sourceSkillDir)) {
    throw "Missing staged skill directory: $sourceSkillDir"
  }
  Assert-SkillShape -SkillDir $sourceSkillDir
}

if ($DryRun) {
  Write-Output "Repo root: $repoRoot"
  Write-Output "Source root: $resolvedSourceRoot"
  Write-Output "Destination root: $resolvedDestinationRoot"
  Write-Output "Backup root: $backupRoot"
  foreach ($skillName in $skillNames) {
    $destinationSkillDir = Join-Path $resolvedDestinationRoot $skillName
    if (Test-Path $destinationSkillDir) {
      Write-Output "Would back up existing $skillName to $(Join-Path $backupRoot $skillName)"
    }
    Write-Output "Would install $skillName from $(Join-Path $resolvedSourceRoot $skillName) to $destinationSkillDir"
  }
  return
}

[void][System.IO.Directory]::CreateDirectory($resolvedDestinationRoot)
[void][System.IO.Directory]::CreateDirectory($backupRoot)

foreach ($skillName in $skillNames) {
  $sourceSkillDir = Join-Path $resolvedSourceRoot $skillName
  $destinationSkillDir = Join-Path $resolvedDestinationRoot $skillName
  $backupSkillDir = Join-Path $backupRoot $skillName

  if (Test-Path $destinationSkillDir) {
    [void][System.IO.Directory]::CreateDirectory($backupRoot)
    Copy-Item -Path $destinationSkillDir -Destination $backupSkillDir -Recurse -Force
  } else {
    [void][System.IO.Directory]::CreateDirectory($destinationSkillDir)
  }

  Copy-Item -Path (Join-Path $sourceSkillDir "*") -Destination $destinationSkillDir -Recurse -Force
}

Write-Output "Installed FitTrack repo-local skills into $resolvedDestinationRoot"
Write-Output "Backups (if any) were written to $backupRoot"
Write-Output "Next steps:"
Write-Output "1. Restart Codex so the repo-local skills are discovered."
Write-Output '2. Smoke test with $integration, $premium-route-rebuild, $frontend, $frontend-uiux-polish, and $quality-assurance.'
Write-Output '3. Confirm $skill-improver does not auto-trigger.'
