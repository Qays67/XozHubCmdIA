@echo off
setlocal EnableExtensions
title XozHub.GPT - creer le fichier a envoyer

set "STAGE=%TEMP%\xozhub-partage"
set "ZIP=%~dp0XozHub-GPT.zip"

echo.
echo    ==========================================================
echo     XozHub.GPT - creation du fichier a envoyer
echo    ==========================================================
echo.
echo    Un SEUL fichier va etre cree ici :
echo.
echo       %ZIP%
echo.
echo    Tu l'envoies a tes potes. De leur cote :
echo      1. clic droit sur le .zip  -^>  Extraire tout
echo      2. double-clic sur  install.cmd
echo      3. l'IA s'installe et une fenetre s'ouvre toute seule
echo.
echo    Il ne contient que le necessaire (pas les scripts d'aide).
echo.

rem --- 1) copie propre des fichiers dans un dossier temporaire ---
if exist "%STAGE%" rd /s /q "%STAGE%" >nul 2>nul
mkdir "%STAGE%" >nul 2>nul
xcopy "%~dp0bin" "%STAGE%\bin" /E /I /Y /Q >nul
xcopy "%~dp0src" "%STAGE%\src" /E /I /Y /Q >nul
copy /Y "%~dp0package.json" "%STAGE%\" >nul 2>nul
copy /Y "%~dp0xozhub.cmd" "%STAGE%\" >nul 2>nul
copy /Y "%~dp0install.cmd" "%STAGE%\" >nul 2>nul
copy /Y "%~dp0xoz.cmd" "%STAGE%\" >nul 2>nul
copy /Y "%~dp0README.md" "%STAGE%\" >nul 2>nul
copy /Y "%~dp0.env" "%STAGE%\" >nul 2>nul

rem --- 2) compression ---
if exist "%ZIP%" del /q "%ZIP%" >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path (Join-Path $env:TEMP 'xozhub-partage\*') -DestinationPath '%ZIP%' -Force"

rem --- 3) nettoyage ---
rd /s /q "%STAGE%" >nul 2>nul

echo    ----------------------------------------------------------
if exist "%ZIP%" echo    FICHIER CREE :  XozHub-GPT.zip  ->  envoie-le a tes potes.
if not exist "%ZIP%" echo    ERREUR : le .zip n'a pas pu etre cree. Envoie-moi cette fenetre.
echo    ----------------------------------------------------------
echo.
echo    Dossier du projet :
dir /b "%~dp0"
echo.
pause
