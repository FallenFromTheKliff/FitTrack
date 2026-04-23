param(
  [string[]]$Files,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$RemainingFiles
)

if ($RemainingFiles) {
  $Files = @($Files + $RemainingFiles | Where-Object { $_ })
}

function Get-ChangedFiles {
  $changed = @()
  $changed += (& git diff --name-only --cached 2>$null)
  $changed += (& git diff --name-only 2>$null)
  $changed += (& git ls-files --others --exclude-standard 2>$null)
  return $changed | Where-Object { $_ } | Sort-Object -Unique
}

if (-not $Files -or $Files.Count -eq 0) {
  $Files = Get-ChangedFiles
}

$scope = [ordered]@{
  files = $Files
  web = $false
  mobile = $false
  api = $false
  shared = $false
  ai_microservice = $false
  schema = $false
  migrations = $false
  deploy = $false
  qa_only_candidate = $true
  qa_blockers = @()
}

foreach ($file in $Files) {
  if ($file -match '^apps/web/') { $scope.web = $true }
  if ($file -match '^apps/mobile/') { $scope.mobile = $true }
  if ($file -match '^apps/api/') { $scope.api = $true }
  if ($file -match '^packages/') { $scope.shared = $true }
  if ($file -match '^apps/ai-microservice/') { $scope.ai_microservice = $true }
  if ($file -eq 'apps/api/prisma/schema.prisma') { $scope.schema = $true }
  if ($file -match '^apps/api/prisma/migrations/') { $scope.migrations = $true }
  if (
    $file -eq 'apps/api/railway.toml' -or
    $file -eq 'apps/web/railway.toml' -or
    $file -eq 'docker-compose.yml' -or
    $file -eq 'docker-compose.local-infra.yml' -or
    $file -match '/Dockerfile$'
  ) {
    $scope.deploy = $true
  }

  if ($file -match '^apps/api/' -or $file -match '^packages/') {
    $scope.qa_only_candidate = $false
  }
  if ($file -eq 'apps/api/prisma/schema.prisma' -or $file -match '^apps/api/prisma/migrations/') {
    $scope.qa_only_candidate = $false
  }
  if ($file -match '^apps/api/.+middleware') {
    $scope.qa_only_candidate = $false
  }
  if ($file -match '^packages/types/') {
    $scope.qa_only_candidate = $false
  }
}

if ($scope.schema) { $scope.qa_blockers += 'schema.prisma is outside QA-only scope.' }
if ($scope.migrations) { $scope.qa_blockers += 'Prisma migrations are outside QA-only scope.' }
if ($scope.api) { $scope.qa_blockers += 'API changes are outside QA-only scope.' }
if ($scope.shared) { $scope.qa_blockers += 'Shared package changes are outside QA-only scope.' }

$scope | ConvertTo-Json -Depth 6
