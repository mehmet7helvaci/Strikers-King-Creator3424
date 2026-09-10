@echo off
chcp 65001 > nul
title Strickers King Creator - Veri Merkezi Tuneli
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start_tunnel.ps1"
pause
