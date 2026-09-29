@echo off
rem Inicia o Code Interview Quest: sobe o servidor local e abre o jogo no navegador.
rem Feche esta janela para desligar o servidor.
chcp 65001 >nul
title Code Interview Quest
cd /d "%~dp0.."

where python >nul 2>nul
if %errorlevel%==0 (
    python tools\serve.py 8000 --open
    goto fim
)
where py >nul 2>nul
if %errorlevel%==0 (
    py -3 tools\serve.py 8000 --open
    goto fim
)
echo Python não foi encontrado. Instale em https://www.python.org/downloads/ e marque "Add python.exe to PATH".
pause
exit /b 1

:fim
if errorlevel 1 pause
