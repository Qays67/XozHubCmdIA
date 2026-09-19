@echo off
setlocal EnableExtensions
title XozHub.GPT - fabriquer le fichier a donner

echo.
echo    ==========================================================
echo     XozHub.GPT - fabriquer le fichier a donner aux potes
echo    ==========================================================
echo.
echo    Va etre cree UN SEUL fichier :
echo.
echo       XozHub-GPT-Installer.cmd
echo.
echo    Tes potes le double-cliquent : l'IA s'installe et s'ouvre.
echo    Aucun dossier a envoyer.
echo.

where powershell >nul 2>nul || echo   ERREUR : PowerShell est introuvable sur cet ordinateur.
where powershell >nul 2>nul || pause
where powershell >nul 2>nul || exit /b 1

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fabriquer.ps1"

echo    ----------------------------------------------------------
if exist "%~dp0XozHub-GPT-Installer.cmd" echo    TU PEUX ENVOYER : XozHub-GPT-Installer.cmd
if not exist "%~dp0XozHub-GPT-Installer.cmd" echo    ERREUR : le fichier n'a pas pu etre cree.
if not exist "%~dp0XozHub-GPT-Installer.cmd" echo    Prends une photo de cette fenetre.
echo    ----------------------------------------------------------
echo.
pause
