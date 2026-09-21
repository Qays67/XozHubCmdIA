@echo off
setlocal EnableExtensions
rem Ce fichier doit garder des fins de ligne CRLF (voir .gitattributes).
title XozHub.GPT - verification de l'installation

echo.
echo    ==========================================================
echo     XozHub.GPT : QUI repond quand on tape   xozhub   ?
echo    ==========================================================
echo.

echo  [1] Commandes  xozhub  trouvees dans le PATH
echo      La PREMIERE ligne est celle qui se lance. C'est celle-la
echo      qu'il faut que tu voies.
echo.
where xozhub 2>nul
if errorlevel 1 echo      Aucune commande xozhub dans le PATH.
echo.

echo  [2] Ce dossier-ci
echo      %~dp0
if exist "%~dp0bin\xozhub.js" (echo      bin\xozhub.js : OK) else (echo      bin\xozhub.js : MANQUANT, ce dossier n'est pas le bon)
if exist "%~dp0.env" (echo      .env         : OK) else (echo      .env         : MANQUANT, la cle API sera introuvable)
echo.

echo  [3] Node.js
where node 2>nul
node -v 2>nul
echo.

echo  [4] PATH utilisateur, dans l'ordre
echo      Le dossier de XozHub.GPT doit y figurer, le plus haut possible.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('Path','User')"
echo.

echo    ==========================================================
echo     Fais une capture de cet ecran et envoie-la moi : je saurai
echo     quelle version repond, et pourquoi ce n'est pas la bonne.
echo    ==========================================================
echo.
pause
exit /b 0
