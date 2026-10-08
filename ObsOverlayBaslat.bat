@echo off
chcp 65001 > nul
title Strikers King Creator - OBS Overlay
cd /d "%~dp0"

if exist "%~dp0StrickersKingCreator.exe" (
    start "" "%~dp0StrickersKingCreator.exe" --overlay
) else (
    powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%~dp0app\server.ps1"
    start "" "http://localhost:18888/app/?overlay=1"
)
