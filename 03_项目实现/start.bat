@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" http://127.0.0.1:8123/
node tools\serve.mjs 8123
pause
