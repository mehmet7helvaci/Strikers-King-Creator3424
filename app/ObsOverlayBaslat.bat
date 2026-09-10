@echo off
chcp 65001 > nul
title OBS Overlay - Strickers King Creator
cd /d "%~dp0"

if exist "%~dp0..\StrickersKingCreator.exe" (
    start "" "%~dp0..\StrickersKingCreator.exe" --overlay
) else (
    start "" "http://localhost:18888/?overlay=1"
)
