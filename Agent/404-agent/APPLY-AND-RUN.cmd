@echo off
chcp 65001 >nul
node "%~dp0scripts\apply-agent.mjs" %*
if errorlevel 1 (
  echo.
  echo Apply failed. Please read the message above.
  pause
)
