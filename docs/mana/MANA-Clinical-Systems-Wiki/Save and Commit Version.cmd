@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Save-Version.ps1"
if not exist ".git" (
  echo Snapshot and checksum history saved successfully.
  echo Git is optional and is not installed; no additional step is needed.
  pause
  exit /b 0
)
for /f "tokens=1-3 delims=/ " %%a in ('date /t') do set "TODAY=%%c-%%a-%%b"
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set "NOW=%%a%%b"
git add site CHANGELOG.md HOW*.txt *.cmd *.ps1 .gitignore
set "GIT_AUTHOR_NAME=MANA Wiki"
set "GIT_AUTHOR_EMAIL=local-only@mana-wiki"
set "GIT_COMMITTER_NAME=MANA Wiki"
set "GIT_COMMITTER_EMAIL=local-only@mana-wiki"
git diff --cached --quiet
if errorlevel 1 git commit -m "MANA Wiki update %TODAY% %NOW%"
echo Version saved locally. Nothing was uploaded.
pause
