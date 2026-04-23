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
$files = @(& git diff --name-only --diff-filter=U 2>$null)

$prisma = @($files | Where-Object { $_ -eq 'apps/api/prisma/schema.prisma' -or $_ -match '^apps/api/prisma/migrations/' })
$backend = @($files | Where-Object { $_ -match '^apps/api/' })
$shared = @($files | Where-Object { $_ -match '^packages/' })
$web = @($files | Where-Object { $_ -match '^apps/web/' })
$mobile = @($files | Where-Object { $_ -match '^apps/mobile/' })
$ai = @($files | Where-Object { $_ -match '^apps/ai-microservice/' })

$stopConditions = @()
if ($prisma.Count -gt 0) {
  $stopConditions += 'Run prismaLocal.migrate_status before finishing Prisma conflict resolution.'
}
if ($files | Where-Object { $_ -match 'migration_lock\.toml$' }) {
  $stopConditions += 'migration_lock.toml is conflicted. Treat migration history as high risk and stop if the intent is unclear.'
}
if (($files | Where-Object { $_ -match '^apps/api/prisma/migrations/' }).Count -gt 1) {
  $stopConditions += 'Multiple migration files are conflicted. Stop if the migration history is not clearly additive.'
}

[pscustomobject]@{
  my_branch = $config.my_branch
  shared_base = $config.shared_base
  pr_target = $config.pr_target
  conflicted_files = $files
  categories = [pscustomobject]@{
    prisma = $prisma
    backend = $backend
    shared = $shared
    web = $web
    mobile = $mobile
    ai_microservice = $ai
  }
  resolve_on_branch = $config.my_branch
  never_push_to_main = $true
  never_push_to_teammate_branch = $true
  stop_conditions = $stopConditions
} | ConvertTo-Json -Depth 8
