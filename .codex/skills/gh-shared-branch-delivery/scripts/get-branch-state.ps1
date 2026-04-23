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
$upstream = ((& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null) | Out-String).Trim()
$statusLines = @(& git status --porcelain 2>$null)
$dirty = $statusLines.Count -gt 0
$isDerivedLocalBranch = $false
if ($currentBranch) {
  $derivedPattern = '^{0}([/-].+)$' -f [regex]::Escape($config.my_branch)
  $isDerivedLocalBranch = $currentBranch -match $derivedPattern
}

$ahead = 0
$behind = 0
if ($upstream) {
  $counts = ((& git rev-list --left-right --count "$upstream...HEAD" 2>$null) | Out-String).Trim()
  if ($counts -match '^(?<behind>\d+)\s+(?<ahead>\d+)$') {
    $behind = [int]$Matches['behind']
    $ahead = [int]$Matches['ahead']
  }
}

$blocked = @()
if (-not $currentBranch) { $blocked += 'Unable to detect the current git branch.' }
if ($currentBranch -eq $config.shared_base) { $blocked += 'Never push directly to main - open a PR instead.' }
if ($currentBranch -and $currentBranch -ne $config.my_branch -and $currentBranch -ne $config.shared_base -and -not $isDerivedLocalBranch) {
  $blocked += "Current branch '$currentBranch' does not match my_branch '$($config.my_branch)'."
}

[pscustomobject]@{
  my_branch = $config.my_branch
  role = $config.role
  shared_base = $config.shared_base
  pr_target = $config.pr_target
  current_branch = $currentBranch
  is_derived_local_branch = $isDerivedLocalBranch
  expected_upstream = "origin/$($config.my_branch)"
  upstream = $upstream
  ahead = $ahead
  behind = $behind
  diverged = ($ahead -gt 0 -and $behind -gt 0)
  dirty = $dirty
  can_push = ($currentBranch -eq $config.my_branch)
  can_open_pr = ($currentBranch -eq $config.my_branch)
  blocked_reasons = $blocked
} | ConvertTo-Json -Depth 6
