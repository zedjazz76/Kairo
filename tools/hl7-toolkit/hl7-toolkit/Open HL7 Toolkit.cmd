@echo off
setlocal
title HL7 Toolkit
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0service\Start-HL7Toolkit.ps1"
if errorlevel 1 (
  echo.
  echo HL7 Toolkit could not start. Review the message above.
  pause
)
endlocal
