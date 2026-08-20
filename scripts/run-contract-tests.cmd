@echo off
where node >nul 2>nul
if errorlevel 1 set "PATH=C:\Users\rdunn\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
node --test --test-isolation=none "%~dp0..\shared\contracts\tests\contracts.test.ts"
