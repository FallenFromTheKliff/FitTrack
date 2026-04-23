function Get-BranchPolicyConfig {
  $policyPath = Join-Path $PSScriptRoot '..\references\branch-policy.md'
  $config = [ordered]@{
    my_branch = $null
    role = $null
    shared_base = $null
    pr_target = $null
  }

  foreach ($line in Get-Content $policyPath) {
    if ($line -match '^(my_branch|role|shared_base|pr_target)\s*=\s*(.+?)\s*$') {
      $key = $Matches[1]
      $value = ($Matches[2] -replace '\s+#.*$', '').Trim()
      if (-not $config[$key]) {
        $config[$key] = $value
      }
    }
  }

  foreach ($key in $config.Keys) {
    if (-not $config[$key]) {
      throw "Missing branch policy config value for '$key'."
    }
  }

  return [pscustomobject]$config
}

$config = Get-BranchPolicyConfig
$currentBranch = ((& git branch --show-current 2>$null) | Out-String).Trim()
$dirty = @(& git status --porcelain 2>$null).Count -gt 0
$conflictedFiles = @(& git diff --name-only --diff-filter=U 2>$null)

$blocked = @()
if (-not $currentBranch) { $blocked += 'Unable to detect the current branch.' }
if ($currentBranch -eq $config.shared_base) { $blocked += 'Switch to my_branch before merging main.' }
if ($currentBranch -ne $config.my_branch) { $blocked += "Current branch '$currentBranch' does not match my_branch '$($config.my_branch)'." }
if ($dirty) { $blocked += 'Working tree is dirty. Commit or stash changes before merging main.' }
if ($conflictedFiles.Count -gt 0) { $blocked += 'Unresolved merge conflicts already exist.' }

[pscustomobject]@{
  current_branch = $currentBranch
  my_branch = $config.my_branch
  shared_base = $config.shared_base
  pr_target = $config.pr_target
  ready = ($blocked.Count -eq 0)
  blocked_reasons = $blocked
  next_steps = @(
    "git fetch origin",
    "git checkout $($config.shared_base)",
    "git pull origin $($config.shared_base)",
    "git checkout $($config.my_branch)",
    "git merge $($config.shared_base)"
  )
} | ConvertTo-Json -Depth 6
