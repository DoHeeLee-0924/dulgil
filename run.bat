@echo off
setlocal
cd /d "%~dp0"
title Dulgil - Local Server
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install Node.js and run this file again.
  pause
  exit /b 1
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 (
  echo Please update Node.js to version 22 or newer.
  pause
  exit /b 1
)
echo Starting Dulgil. Your browser will open when the server is ready.
echo Keep this window open. Press Ctrl+C to stop the server.
node server.mjs --open
if errorlevel 1 (
  echo Server could not start. See the message above.
  pause
  exit /b 1
)
endlocal
