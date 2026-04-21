param(
  [ValidateSet("all", "mcp", "runtime")]
  [string]$Mode = "all",
  [string]$WorkspaceRoot = $(Resolve-Path (Join-Path $PSScriptRoot "..\\..")).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-FileText {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Required file not found: $Path"
  }

  return Get-Content -Path $Path -Raw
}

function Normalize-ConfigText {
  param([AllowNull()][string]$Text)

  if ($null -eq $Text) {
    return ""
  }

  return ($Text.ToLowerInvariant() -replace "\\", "/")
}

function Resolve-CodexConfigPath {
  param([string]$RepoRoot)

  $candidates = @()

  if ($env:CODEX_CONFIG_PATH) {
    $candidates += [pscustomobject]@{
      Path = $env:CODEX_CONFIG_PATH
      Source = "env"
    }
  }

  $candidates += [pscustomobject]@{
    Path = (Join-Path $RepoRoot ".codex\\config.toml")
    Source = "repo-local"
  }

  if ($env:USERPROFILE) {
    $candidates += [pscustomobject]@{
      Path = (Join-Path $env:USERPROFILE ".codex\\config.toml")
      Source = "global"
    }
  }

  foreach ($candidate in $candidates) {
    if ($candidate.Path -and (Test-Path -LiteralPath $candidate.Path)) {
      return $candidate
    }
  }

  $checkedPaths = $candidates |
    Where-Object { $_.Path } |
    Select-Object -ExpandProperty Path

  throw "Required Codex config not found. Checked: $($checkedPaths -join ', ')"
}

function Get-ListeningConnection {
  param([int]$Port)

  try {
    return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
      Select-Object -First 1
  } catch {
    return $null
  }
}

function Get-ListeningState {
  param([int]$Port)

  if ($null -ne (Get-ListeningConnection -Port $Port)) {
    return "yes"
  }

  return "no"
}

function Read-HostManifest {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Get-ManagedProcess {
  param([AllowNull()][object]$Record)

  if ($null -eq $Record -or $null -eq $Record.pid) {
    return $null
  }

  try {
    return Get-Process -Id ([int]$Record.pid) -ErrorAction Stop
  } catch {
    return $null
  }
}

function Get-TargetManifestRecord {
  param(
    [AllowNull()][object]$Manifest,
    [string]$Target
  )

  if ($null -eq $Manifest -or $null -eq $Manifest.processes) {
    return $null
  }

  return $Manifest.processes | Where-Object { $_.target -eq $Target } | Select-Object -First 1
}

function Get-VSCodeServerMap {
  param([object]$Config)

  $map = @{}
  if ($null -eq $Config -or $null -eq $Config.servers) {
    return $map
  }

  foreach ($property in $Config.servers.PSObject.Properties) {
    $map[$property.Name] = $property.Value
  }

  return $map
}

function Test-UrlReachability {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    return [pscustomobject]@{
      Reachable = $true
      Status = [string][int]$response.StatusCode
      Notes = "reachable"
    }
  } catch {
    if ($_.Exception.Response) {
      return [pscustomobject]@{
        Reachable = $true
        Status = [string][int]$_.Exception.Response.StatusCode
        Notes = "reachable with a non-success HTTP status"
      }
    }
  }

  return [pscustomobject]@{
    Reachable = $false
    Status = "none"
    Notes = "unreachable"
  }
}

function Test-UrlTarget {
  param(
    [string]$Name,
    [string]$Url,
    [bool]$Required,
    [string]$PrimaryStart,
    [string]$FallbackStart,
    [string]$ManifestTarget = $Name,
    [AllowNull()][object]$Manifest
  )

  $uri = [Uri]$Url
  $reachability = Test-UrlReachability -Url $Url
  $connection = Get-ListeningConnection -Port $uri.Port
  $ownerPid = if ($null -ne $connection) { [string][int]$connection.OwningProcess } else { "" }
  $record = Get-TargetManifestRecord -Manifest $Manifest -Target $ManifestTarget
  $managedProcess = Get-ManagedProcess -Record $record
  $runtimeOwner = "none"

  if ($null -ne $record -and $null -ne $managedProcess -and $ownerPid -eq [string][int]$record.pid) {
    $runtimeOwner = "managed"
  } elseif ($ownerPid) {
    $runtimeOwner = "unmanaged"
  } elseif ($null -ne $record) {
    $runtimeOwner = "stale-record"
  }

  $notes = $reachability.Notes
  if ($runtimeOwner -eq "managed" -and -not $reachability.Reachable) {
    $notes = "managed runtime present but unreachable; rerun tasks/integration-builder/integration-host-start.cmd -RestartManaged"
  } elseif ($runtimeOwner -eq "stale-record") {
    $notes = "stale managed runtime manifest record; rerun tasks/integration-builder/integration-host-start.cmd -RestartManaged"
  } elseif ($runtimeOwner -eq "unmanaged" -and $ownerPid) {
    $notes = "reachable via unmanaged listener pid=$ownerPid"
  }

  return [pscustomobject]@{
    Target = $Name
    Required = if ($Required) { "yes" } else { "no" }
    Port = [string]$uri.Port
    RuntimeOwner = $runtimeOwner
    OwnerPid = if ($ownerPid) { $ownerPid } else { "" }
    Listening = Get-ListeningState -Port $uri.Port
    Reachable = if ($reachability.Reachable) { "yes" } else { "no" }
    Status = $reachability.Status
    PrimaryStart = $PrimaryStart
    FallbackStart = $FallbackStart
    Notes = $notes
  }
}

function Show-Section {
  param(
    [string]$Title,
    [object[]]$Rows
  )

  Write-Output ""
  Write-Output "## $Title"
  Write-Output ($Rows | Format-Table -AutoSize | Out-String).TrimEnd()
}

$repoRoot = (Resolve-Path -LiteralPath $WorkspaceRoot).Path
$codexConfig = Resolve-CodexConfigPath -RepoRoot $repoRoot
$codexConfigPath = $codexConfig.Path
$codexConfigSource = $codexConfig.Source
$vscodeConfigPath = Join-Path $repoRoot ".vscode\\mcp.json"
$apiDistEntry = Join-Path $repoRoot "apps\\api\\dist\\src\\main.js"
$manifestPath = Join-Path (Join-Path $repoRoot ".artifacts") "integration-host-manifest.json"
$hostManifest = Read-HostManifest -Path $manifestPath

$apiPrimaryStart = "tasks/integration-builder/integration-host-start.cmd"
$apiFallbackStart = if (Test-Path -LiteralPath $apiDistEntry) {
  "cd apps/api; node dist/src/main.js"
} else {
  "pnpm.cmd dev:api"
}

$failureMessages = New-Object System.Collections.Generic.List[string]

if ($Mode -in @("all", "mcp")) {
  $codexText = Get-FileText -Path $codexConfigPath
  $normalizedCodexText = Normalize-ConfigText -Text $codexText
  $vscodeConfig = Get-Content -Path $vscodeConfigPath -Raw | ConvertFrom-Json
  $vscodeServers = Get-VSCodeServerMap -Config $vscodeConfig

  $requiredLocalMcp = @(
    @{
      Id = "serena"
      CodexSection = "[mcp_servers.serena]"
      CodexMarkers = @('command = "serena"', "start-mcp-server", "--context", "codex")
      VSCodeName = "oraios/serena"
      VSCodeCommand = "serena"
      VSCodeArgMarkers = @("start-mcp-server", "--project")
      VSCodeEnvMarkers = @()
    },
    @{
      Id = "playwright"
      CodexSection = "[mcp_servers.playwright]"
      CodexMarkers = @('command = "pnpm.cmd"', "playwright-mcp", ".playwright-mcp.json")
      VSCodeName = "FitTrack Playwright"
      VSCodeCommand = "pnpm.cmd"
      VSCodeArgMarkers = @("playwright-mcp", ".playwright-mcp.json")
      VSCodeEnvMarkers = @("playwright_browsers_path=0")
    },
    @{
      Id = "prismaLocal"
      CodexSection = "[mcp_servers.prismaLocal]"
      CodexMarkers = @('command = "pnpm.cmd"', "apps\\api", '"prisma"', '"mcp"')
      VSCodeName = "FitTrack Prisma Local"
      VSCodeCommand = "pnpm.cmd"
      VSCodeArgMarkers = @("apps/api", "prisma", "mcp")
      VSCodeEnvMarkers = @()
    },
    @{
      Id = "swagger"
      CodexSection = "[mcp_servers.swagger]"
      CodexMarkers = @('command = "pnpm.cmd"', "swagger-mcp", "v1/docs-json")
      VSCodeName = "FitTrack Swagger"
      VSCodeCommand = "pnpm.cmd"
      VSCodeArgMarkers = @("swagger-mcp")
      VSCodeEnvMarkers = @("api_base_url=http://127.0.0.1:3001", "api_docs_url=http://127.0.0.1:3001/v1/docs-json")
    }
  )

  $mcpRows = foreach ($server in $requiredLocalMcp) {
    $normalizedCodexSection = Normalize-ConfigText -Text $server.CodexSection
    $codexPresent = $normalizedCodexText.Contains($normalizedCodexSection)
    $codexHealthy = $codexPresent
    foreach ($marker in $server.CodexMarkers) {
      $normalizedMarker = Normalize-ConfigText -Text $marker
      if (-not $normalizedCodexText.Contains($normalizedMarker)) {
        $codexHealthy = $false
      }
    }

    $vscodePresent = $vscodeServers.ContainsKey($server.VSCodeName)
    $vscodeHealthy = $false

    if ($vscodePresent) {
      $vscodeServer = $vscodeServers[$server.VSCodeName]
      $argsText = ""
      $envText = ""
      $argsProperty = $vscodeServer.PSObject.Properties["args"]
      $envProperty = $vscodeServer.PSObject.Properties["env"]

      if ($null -ne $argsProperty -and $null -ne $argsProperty.Value) {
        $argsText = [string]::Join(" ", @($argsProperty.Value))
      }
      if ($null -ne $envProperty -and $null -ne $envProperty.Value) {
        $envText = ($envProperty.Value.PSObject.Properties | ForEach-Object { "{0}={1}" -f $_.Name, $_.Value }) -join " "
      }

      $vscodeHealthy = $vscodeServer.command -eq $server.VSCodeCommand
      $normalizedArgsText = Normalize-ConfigText -Text $argsText
      $normalizedEnvText = Normalize-ConfigText -Text $envText
      foreach ($marker in $server.VSCodeArgMarkers) {
        if (-not $normalizedArgsText.Contains((Normalize-ConfigText -Text $marker))) {
          $vscodeHealthy = $false
        }
      }
      foreach ($marker in $server.VSCodeEnvMarkers) {
        if (-not $normalizedEnvText.Contains((Normalize-ConfigText -Text $marker))) {
          $vscodeHealthy = $false
        }
      }
    }

    $notes = if ($codexHealthy -and $vscodeHealthy) {
      if ($codexConfigSource -eq "repo-local") {
        "aligned"
      } else {
        "aligned via $codexConfigSource config"
      }
    } elseif (-not $codexPresent -or -not $vscodePresent) {
      "missing from one client config"
    } else {
      "present but drifted"
    }

    if (-not $codexHealthy -or -not $vscodeHealthy) {
      $failureMessages.Add("Local MCP parity failed for $($server.Id).")
    }

    [pscustomobject]@{
      Server = $server.Id
      Required = "yes"
      CodexSource = $codexConfigSource
      CodexConfig = if ($codexHealthy) { "ok" } else { "drift" }
      VSCodeConfig = if ($vscodeHealthy) { "ok" } else { "drift" }
      Notes = $notes
    }
  }

  Show-Section -Title "Local MCP Parity" -Rows $mcpRows
}

if ($Mode -in @("all", "runtime")) {
  $runtimeRows = @(
    (Test-UrlTarget -Name "API" -Url "http://127.0.0.1:3001/v1/health" -Required $true -PrimaryStart "tasks/integration-builder/integration-host-start.cmd" -FallbackStart $apiFallbackStart -ManifestTarget "API" -Manifest $hostManifest),
    (Test-UrlTarget -Name "API docs" -Url "http://127.0.0.1:3001/v1/docs" -Required $true -PrimaryStart "tasks/integration-builder/integration-host-start.cmd" -FallbackStart $apiFallbackStart -ManifestTarget "API" -Manifest $hostManifest),
    (Test-UrlTarget -Name "Web" -Url "http://127.0.0.1:8080/login" -Required $true -PrimaryStart "tasks/integration-builder/integration-host-start.cmd" -FallbackStart "pnpm.cmd dev:web" -Manifest $hostManifest),
    (Test-UrlTarget -Name "Mobile Expo Web" -Url "http://127.0.0.1:8081/login" -Required $true -PrimaryStart "tasks/integration-builder/integration-host-start.cmd" -FallbackStart "pnpm.cmd dev:mobile:web" -Manifest $hostManifest),
    (Test-UrlTarget -Name "AI" -Url "http://127.0.0.1:8000/health" -Required $false -PrimaryStart "tasks/integration-builder/integration-host-start.cmd -IncludeAi" -FallbackStart "pnpm.cmd dev:ai" -Manifest $hostManifest)
  )

  foreach ($row in $runtimeRows) {
    if ($row.Required -eq "yes" -and $row.Reachable -ne "yes") {
      $failureMessages.Add("Required runtime surface is not reachable: $($row.Target).")
    }
  }

  Show-Section -Title "Local Host Runtime" -Rows $runtimeRows
}

if ($failureMessages.Count -gt 0) {
  Write-Output ""
  Write-Output "Preflight failed:"
  foreach ($message in $failureMessages) {
    Write-Output "- $message"
  }
  exit 1
}

Write-Output ""
Write-Output "Preflight passed."
