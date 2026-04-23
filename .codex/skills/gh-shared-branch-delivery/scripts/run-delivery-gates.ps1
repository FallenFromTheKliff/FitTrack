param(
  [ValidateSet('fast', 'normal', 'strict')]
  [string]$Mode = 'normal',
  [string[]]$Files,
  [switch]$Execute
  ,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingFiles
)

if ($RemainingFiles) {
  $Files = @($Files + $RemainingFiles | Where-Object { $_ })
}

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
if ($Files) {
  $scope = & (Join-Path $PSScriptRoot 'get-change-scope.ps1') -Files $Files | ConvertFrom-Json
} else {
  $scope = & (Join-Path $PSScriptRoot 'get-change-scope.ps1') | ConvertFrom-Json
}

$commands = New-Object System.Collections.Generic.List[object]
$requiredMcps = New-Object System.Collections.Generic.List[string]

function Add-Command {
  param(
    [string]$Name,
    [string]$Command,
    [string]$Workdir = '.'
  )

  $commands.Add([pscustomobject]@{
    name = $Name
    command = $Command
    workdir = $Workdir
  })
}

if ($scope.shared) {
  Add-Command -Name 'root-lint' -Command 'pnpm lint'
  Add-Command -Name 'root-typecheck' -Command 'pnpm typecheck'
}

if ($scope.web -and -not $scope.shared) {
  Add-Command -Name 'web-lint' -Command 'pnpm --filter @fittrack/web lint'
  Add-Command -Name 'web-typecheck' -Command 'pnpm --filter @fittrack/web typecheck'
  if ($Mode -ne 'fast') {
    Add-Command -Name 'web-build' -Command 'pnpm --filter @fittrack/web build'
  }
}

if ($scope.mobile -and -not $scope.shared) {
  Add-Command -Name 'mobile-lint' -Command 'pnpm --filter @fittrack/mobile lint'
  Add-Command -Name 'mobile-typecheck' -Command 'pnpm --filter @fittrack/mobile typecheck'
}

if ($scope.api -and -not $scope.shared) {
  Add-Command -Name 'api-lint' -Command 'pnpm --filter @fittrack/api run lint:check'
  Add-Command -Name 'api-build' -Command 'pnpm --filter @fittrack/api run build'
  if ($Mode -eq 'strict') {
    Add-Command -Name 'api-test' -Command 'pnpm --filter @fittrack/api run test'
  }
}

if ($scope.ai_microservice) {
  Add-Command -Name 'ai-pytest' -Command 'uv run pytest' -Workdir 'apps/ai-microservice'
}

if ($scope.schema -or $scope.migrations) {
  $requiredMcps.Add('prismaLocal.migrate_status')
}
if ($scope.api) {
  $requiredMcps.Add('swagger')
}
if ($scope.web) {
  $requiredMcps.Add('chromeDevtools')
}

$result = [ordered]@{
  mode = $Mode
  my_branch = $config.my_branch
  shared_base = $config.shared_base
  pr_target = $config.pr_target
  qa_only_candidate = [bool]$scope.qa_only_candidate
  qa_blockers = @($scope.qa_blockers)
  scope = $scope
  commands = $commands
  required_mcps = $requiredMcps
  executed = $false
  execution_results = @()
}

if ($Execute) {
  $executionResults = New-Object System.Collections.Generic.List[object]
  foreach ($item in $commands) {
    Push-Location $item.workdir
    try {
      Invoke-Expression $item.command | Out-Null
      $executionResults.Add([pscustomobject]@{
        name = $item.name
        command = $item.command
        workdir = $item.workdir
        success = ($LASTEXITCODE -eq 0)
        exit_code = $LASTEXITCODE
      })
      if ($LASTEXITCODE -ne 0) {
        Pop-Location
        $result.executed = $true
        $result.execution_results = $executionResults
        $result | ConvertTo-Json -Depth 8
        exit $LASTEXITCODE
      }
    }
    finally {
      Pop-Location
    }
  }
  $result.executed = $true
  $result.execution_results = $executionResults
}

$result | ConvertTo-Json -Depth 8
