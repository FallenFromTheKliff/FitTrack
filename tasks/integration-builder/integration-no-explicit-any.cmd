@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
node "%SCRIPT_DIR%check-no-explicit-any.mjs" %*
set "EXIT_CODE=%ERRORLEVEL%"

endlocal & exit /b %EXIT_CODE%
