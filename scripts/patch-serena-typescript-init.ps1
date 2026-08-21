param(
    [string]$RepoPath = (Get-Location).Path,
    [switch]$RunHealthCheck
)

$ErrorActionPreference = "Stop"

$adapterPath = Join-Path $env:APPDATA "uv\tools\serena-agent\Lib\site-packages\solidlsp\language_servers\typescript_language_server.py"

if (-not (Test-Path -LiteralPath $adapterPath)) {
    throw "Serena TypeScript adapter not found at: $adapterPath"
}

$content = Get-Content -LiteralPath $adapterPath -Raw
$alreadyPatched = $content -match '"initializationOptions"\s*:\s*\{\s*"disableAutomaticTypingAcquisition"\s*:\s*True'

if ($alreadyPatched) {
    Write-Host "Serena adapter is already patched."
}
else {
    $replacement = @'
            "workspaceFolders": [
                {
                    "uri": root_uri,
                    "name": os.path.basename(repository_absolute_path),
                }
            ],
            "initializationOptions": {
                "disableAutomaticTypingAcquisition": True,
            },
'@

    $workspaceFoldersPattern = '(?ms)^\s*"workspaceFolders": \[\r?\n\s*\{\r?\n\s*"uri": root_uri,\r?\n\s*"name": os\.path\.basename\(repository_absolute_path\),\r?\n\s*\}\r?\n\s*\],?'
    $workspaceFoldersRegex = [regex]::new($workspaceFoldersPattern)
    $updatedContent = $workspaceFoldersRegex.Replace($content, $replacement, 1)

    if ($updatedContent -eq $content) {
        throw "Could not find the expected workspaceFolders block in $adapterPath. Serena may have changed versions."
    }

    $backupPath = "$adapterPath.bak-codex-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item -LiteralPath $adapterPath -Destination $backupPath -Force
    Set-Content -LiteralPath $adapterPath -Value $updatedContent -Encoding UTF8

    Write-Host "Patched Serena adapter."
    Write-Host "Backup saved to: $backupPath"
}

$updated = Get-Content -LiteralPath $adapterPath -Raw
$verificationPattern = '(?s)"workspaceFolders": \[\s*\{\s*"uri": root_uri,\s*"name": os\.path\.basename\(repository_absolute_path\),\s*\}\s*\],\s*"initializationOptions": \{\s*"disableAutomaticTypingAcquisition": True,\s*\},'

if ($updated -notmatch $verificationPattern) {
    throw "Patch verification failed. The expected initializationOptions block was not found after writing."
}

Write-Host "Verification passed."
Write-Host "Adapter path: $adapterPath"

if ($RunHealthCheck) {
    $serena = Get-Command serena -ErrorAction SilentlyContinue
    if (-not $serena) {
        throw "Serena CLI is not on PATH, so health check could not be run."
    }

    Write-Host "Running Serena health check for: $RepoPath"
    & $serena.Source project health-check $RepoPath
}
else {
    Write-Host "Next step: restart VS Code/Codex, then run:"
    Write-Host "  serena project health-check `"$RepoPath`""
}
