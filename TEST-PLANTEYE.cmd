@echo off
setlocal
cd /d "%~dp0"
call npm run test:decision
if errorlevel 1 goto failed
call npm run test:agent-production
if errorlevel 1 goto failed
call npm run test:normal-pattern
if errorlevel 1 goto failed
call npm run test:test-data-power
if errorlevel 1 goto failed
call npm run lint
if errorlevel 1 goto failed
call npm run build -- --configLoader runner
if errorlevel 1 goto failed
echo All checks passed.
pause
exit /b 0
:failed
echo A check failed. Read the message above.
pause
exit /b 1
