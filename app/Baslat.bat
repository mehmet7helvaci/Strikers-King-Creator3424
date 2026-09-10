@echo off
chcp 65001 > nul
title Strickers King Creator
cd /d "%~dp0"

if exist "%~dp0..\StrickersKingCreator.exe" (
    start "" "%~dp0..\StrickersKingCreator.exe"
) else (
    powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File "%~dp0server.ps1"
)

