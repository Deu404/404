@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto no_node
if not exist "node_modules\vite\bin\vite.js" (
  call npm ci
  if errorlevel 1 goto failed
)
call npm run dev:all
if errorlevel 1 goto failed
exit /b 0
:no_node
echo Node.js 24 or later is required.
:failed
echo Start failed. Read the message above. Another PlantEye server may already use port 5173 or 8787.
pause
exit /b 1
