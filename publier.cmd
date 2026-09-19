@echo off
setlocal EnableExtensions
title XozHub.GPT - publier la ligne d'installation

echo.
echo    ==========================================================
echo     XozHub.GPT - publier la ligne sur GitHub
echo    ==========================================================
echo.
echo    Va etre faite la mise a jour du fichier que tout le monde
echo    telecharge quand il colle la ligne d'installation :
echo.
echo       install-en-ligne.ps1
echo.
echo    Laisse cette fenetre ouverte, ca prend une minute.
echo.

where powershell >nul 2>nul || echo   ERREUR : PowerShell est introuvable sur cet ordinateur.
where powershell >nul 2>nul || pause
where powershell >nul 2>nul || exit /b 1

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0publier.ps1"

echo    ----------------------------------------------------------
echo.
pause
