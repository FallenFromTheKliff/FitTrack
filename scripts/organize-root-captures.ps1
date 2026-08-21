param(
    [string]$RepoPath = (Get-Location).Path,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath $RepoPath).Path
$capturePrefixes = @(
    "admin-",
    "ai-domain-",
    "analytics-domain-",
    "artifacts-",
    "auth-",
    "bookings-",
    "bookings-member-",
    "coach-",
    "fitness-",
    "membership-",
    "mcp-",
    "mobile-",
    "notifications-",
    "nutrition-",
    "user-",
    "web-"
)

$allowedExtensions = @(
    ".json",
    ".log",
    ".md",
    ".png",
    ".txt",
    ".yaml",
    ".yml"
)

$rootFiles = Get-ChildItem -LiteralPath $repoRoot -File | Where-Object {
    $name = $_.Name
    $extension = $_.Extension.ToLowerInvariant()
    $hasCapturePrefix = $capturePrefixes | Where-Object { $name.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) }
    $hasCapturePrefix -and $allowedExtensions -contains $extension
} | Sort-Object Name

if (-not $rootFiles) {
    Write-Host "No matching root-level capture files found."
    return
}

$batchName = Get-Date -Format "yyyyMMdd-HHmmss"
$destinationRoot = Join-Path $repoRoot ".artifacts\root-captures\$batchName"

if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $destinationRoot | Out-Null
}

$manifest = New-Object System.Collections.Generic.List[object]

foreach ($file in $rootFiles) {
    $destinationPath = Join-Path $destinationRoot $file.Name

    $manifest.Add([pscustomobject]@{
        name = $file.Name
        size = $file.Length
        source = $file.FullName
        destination = $destinationPath
        last_write_time = $file.LastWriteTime.ToString("o")
    })

    if (-not $DryRun) {
        Move-Item -LiteralPath $file.FullName -Destination $destinationPath
    }
}

$summary = $manifest |
    Group-Object {
        $fileName = $_.name
        $matchingPrefix = $capturePrefixes | Where-Object {
            $PSItem -and $fileName.StartsWith($PSItem, [System.StringComparison]::OrdinalIgnoreCase)
        } | Select-Object -First 1
        if ($matchingPrefix) { $matchingPrefix } else { "(unknown)" }
    } |
    Sort-Object Name |
    ForEach-Object {
        [pscustomobject]@{
            prefix = $_.Name
            count = $_.Count
        }
    }

if (-not $DryRun) {
    $manifestPath = Join-Path $destinationRoot "manifest.json"
    $summaryPath = Join-Path $destinationRoot "summary.json"
    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    $summary | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
}

Write-Host ("{0} root-level capture files {1}." -f $manifest.Count, $(if ($DryRun) { "would be moved" } else { "moved" }))
if (-not $DryRun) {
    Write-Host "Destination: $destinationRoot"
}

$summary | Format-Table -AutoSize
