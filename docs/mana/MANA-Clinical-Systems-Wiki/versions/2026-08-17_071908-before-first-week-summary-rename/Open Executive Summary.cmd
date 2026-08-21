@echo off
set "WIKI_URL=file:///%~dp0site/index.html#executive-summary"
set "WIKI_URL=%WIKI_URL:\=/%"
start "" "%WIKI_URL%"
