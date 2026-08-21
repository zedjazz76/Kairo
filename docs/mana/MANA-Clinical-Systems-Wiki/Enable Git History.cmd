@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
  echo Git is not installed on this computer.
  echo No action is required. The MANA Wiki uses complete timestamped snapshots
  echo and a checksum history through Save Version.cmd.
  echo Nothing has been uploaded or changed.
  pause
  exit /b 0
)
if not exist ".git" git init
git add site CHANGELOG.md HOW*.txt *.cmd *.ps1 .gitignore
set "GIT_AUTHOR_NAME=MANA Wiki"
set "GIT_AUTHOR_EMAIL=local-only@mana-wiki"
set "GIT_COMMITTER_NAME=MANA Wiki"
set "GIT_COMMITTER_EMAIL=local-only@mana-wiki"
git diff --cached --quiet
if errorlevel 1 git commit -m "Establish permanent MANA Clinical Systems Wiki"
echo Local Git history is enabled. Nothing was uploaded.
pause
