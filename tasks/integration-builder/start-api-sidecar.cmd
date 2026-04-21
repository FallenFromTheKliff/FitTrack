@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0..\.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"

set "PORT_ARG=%~1"
if "%PORT_ARG%"=="" set "PORT_ARG=3004"

set "ARTIFACTS_DIR=%ROOT%\.artifacts"
if not exist "%ARTIFACTS_DIR%" mkdir "%ARTIFACTS_DIR%"

set "OUT_LOG=%ARTIFACTS_DIR%\api-sidecar-%PORT_ARG%.out.log"
set "ERR_LOG=%ARTIFACTS_DIR%\api-sidecar-%PORT_ARG%.err.log"
set "BOOT_CMD=pnpm.cmd --dir apps/api exec node -r ts-node/register -r tsconfig-paths/register src/main.ts"

if not "%FITTRACK_FORCE_SIDECAR%"=="1" (
  powershell -NoProfile -Command "try { $r = Invoke-RestMethod -Uri 'http://127.0.0.1:3001/v1/health' -TimeoutSec 2; if ($r.data.status -eq 'ok') { exit 42 } } catch { exit 0 }; exit 0" >nul 2>&1
  if "!ERRORLEVEL!"=="42" (
    echo Supervisor API on port 3001 is healthy. Skipping sidecar launch on port %PORT_ARG%.
    echo Set FITTRACK_FORCE_SIDECAR=1 only when you explicitly need an isolated API port.
    exit /b 0
  )
)

rem Start from source to avoid Nest dist cleanup EPERM issues on long-lived local stacks.
powershell -NoProfile -Command "$cmd = 'set PORT=%PORT_ARG% && cd /d ""%ROOT%"" && %BOOT_CMD% 1>> ""%OUT_LOG%"" 2>> ""%ERR_LOG%""'; Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -ArgumentList '/d','/c',$cmd"

echo Started FitTrack API sidecar on port %PORT_ARG%
echo Logs:
echo   %OUT_LOG%
echo   %ERR_LOG%
