@echo off
chcp 65001 > nul
title Strikers King Creator
cd /d "%~dp0"

if exist "%~dp0StrickersKingCreator.exe" (
    start "" "%~dp0StrickersKingCreator.exe"
) else (
    powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%~dp0app\server.ps1"
)
