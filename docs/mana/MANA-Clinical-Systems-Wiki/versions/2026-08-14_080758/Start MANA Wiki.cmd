@echo off
set "WIKI_DIR=%~dp0"
start "MANA Wiki Server" /min powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%WIKI_DIR%serve-wiki.ps1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8765/"

