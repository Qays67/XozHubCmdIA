@echo off
setlocal EnableExtensions
rem Ce fichier doit garder des fins de ligne CRLF (voir .gitattributes).
title XozHub.GPT - reparer la commande xozhub

set "PROJECT=%~dp0"
set "NPMDIR=%APPDATA%\npm"
set "PROBEDIR=%PROJECT:~0,-1%"

echo.
echo    ==========================================================
echo     Reparation de XozHub.GPT
echo    ==========================================================
echo.
echo    Dossier utilise : %PROJECT%
echo    Ce doit etre le dossier qui contient  bin\  et  src\ .
echo.

rem 1) on remet en place les fichiers que forcer.cmd avait renommes
if exist "%NPMDIR%\xozhub.cmd.bak" ren "%NPMDIR%\xozhub.cmd.bak" "xozhub.cmd" >nul 2>nul
if exist "%NPMDIR%\xozhub.bak" ren "%NPMDIR%\xozhub.bak" "xozhub" >nul 2>nul
if exist "%NPMDIR%\xozhub.ps1.bak" ren "%NPMDIR%\xozhub.ps1.bak" "xozhub.ps1" >nul 2>nul
echo   [1/5] Fichiers renommes remis en place - OK
echo.

rem 2) le dossier du projet est ajoute au PATH utilisateur, en tete, puis verifie
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=('%PROJECT%').TrimEnd('\'); $o=('%LOCALAPPDATA%\XozHub').TrimEnd('\'); $p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; $a=@(); foreach($x in ($p -split ';')){ if($x -and $x -ne $o -and $x -ne $d){ $a += $x } }; [Environment]::SetEnvironmentVariable('Path', (@($d) + $a) -join ';', 'User')"
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Environment]::GetEnvironmentVariable('Path','User')" > "%TEMP%\xozhub-path.txt" 2>nul
find /i "%PROBEDIR%" "%TEMP%\xozhub-path.txt" >nul 2>nul
if errorlevel 1 (
  echo   [2/5] ECHEC : le dossier n'a pas pu etre ajoute au PATH utilisateur.
  echo         Utilise la methode du raccourci, indiquee a la fin.
) else (
  echo   [2/5] Dossier present dans le PATH utilisateur - OK
)
echo.

rem 3) les fichiers du projet sont-ils la ?
echo   [3/5] Fichiers du projet :
if exist "%PROJECT%bin\xozhub.js" (echo         bin\xozhub.js : OK) else (echo         bin\xozhub.js : MANQUANT - ce n'est pas le bon dossier)
if exist "%PROJECT%src\app.js" (echo         src\app.js    : OK) else (echo         src\app.js    : MANQUANT)
if exist "%PROJECT%.env" (echo         .env          : OK) else (echo         .env          : MANQUANT - la cle API sera introuvable)
echo.

rem 4) quelles commandes xozhub existent maintenant ?
echo   [4/5] Commandes xozhub trouvees :
where xozhub 2>nul
if errorlevel 1 echo         aucune pour l'instant - normal, ouvre une nouvelle fenetre cmd
echo.

rem 5) le raccourci du Bureau : cree, ou remis a jour s'il existait deja
echo   [5/5] Raccourci "XozHub.GPT" sur le Bureau :
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $d='%PROBEDIR%'; $p=Join-Path ([Environment]::GetFolderPath('Desktop')) 'XozHub.GPT.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($p); $s.TargetPath=Join-Path $d 'xozhub.cmd'; $s.WorkingDirectory='%USERPROFILE%'; $s.IconLocation='%SystemRoot%\System32\cmd.exe,0'; $s.Description='XozHub.GPT - agent de developpement'; $s.Save(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo         Raccourci non cree - tu peux le faire a la main, voir plus bas.
) else (
  echo         Raccourci cree ou remis a jour - OK
)
echo.

echo    ==========================================================
echo     LA METHODE QUI MARCHE TOUJOURS
echo.
echo     1. Ouvre le dossier du projet.
echo     2. Double-clique sur  xozhub.cmd
echo.
echo     Ca lance l'IA sans passer par le PATH : aucun conflit possible.
echo.
echo     Un raccourci  XozHub.GPT  vient d'etre pose sur ton Bureau :
echo     double-clic dessus, et l'IA s'ouvre dans une fenetre cmd.
echo     S'il manque, fais-le a la main : clic droit sur  xozhub.cmd ,
echo     Envoyer vers, puis Bureau - creer un raccourci.
echo.
echo     Ensuite, dans une NOUVELLE fenetre cmd : xozhub
echo    ==========================================================
echo.
pause
exit /b 0
