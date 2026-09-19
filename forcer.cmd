@echo off
setlocal EnableExtensions
rem Ce fichier doit garder des fins de ligne CRLF (voir .gitattributes).
title XozHub.GPT - forcer la version de ce dossier

set "PROJECT=%~dp0"
set "TARGET=%PROJECT%xozhub.cmd"
set "NPMDIR=%APPDATA%\npm"

echo.
echo    ==========================================================
echo     Forcer  xozhub  a lancer la version de CE dossier
echo    ==========================================================
echo.
echo    Dossier : %PROJECT%
echo.

rem 1) le dossier du projet passe devant tout le reste
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=('%PROJECT%').TrimEnd('\'); $o=('%LOCALAPPDATA%\XozHub').TrimEnd('\'); $p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; $a=@(); foreach($x in ($p -split ';')){ if($x -and $x -ne $o -and $x -ne $d){ $a += $x } }; [Environment]::SetEnvironmentVariable('Path', (@($d) + $a) -join ';', 'User')"
echo   [1/3] Dossier du projet place en tete du PATH utilisateur - OK
echo.

rem 2) on desactive les autres commandes xozhub quand c'est possible
echo   [2/3] Autres commandes xozhub trouvees sur la machine :
echo.
set "FOUND="
for /f "delims=" %%p in ('where xozhub 2^>nul') do (
  if /i "%%p"=="%TARGET%" (
    echo         %%p
    echo           c'est la tienne, on la garde
  ) else (
    set "FOUND=1"
    call :neutraliser "%%p"
  )
)
if not defined FOUND echo         aucune autre commande xozhub - rien a desactiver
echo.

rem 3) alias garanti
echo   [3/3] Alias  xoz  pret : il lance toujours la version de ce dossier.
echo.

echo    ==========================================================
echo     Ouvre une NOUVELLE fenetre cmd, puis tape :
echo.
echo        xozhub   pour la commande normale
echo        xoz      pour forcer la version de ce dossier, toujours
echo    ==========================================================
echo.
pause
exit /b 0

rem --------------------------------------------------------------------------

:neutraliser
set "F=%~1"
set "D=%~dp1"
echo         %F%
if /i "%D%"=="%NPMDIR%\" (
  echo           installation npm globale. Rien n'est modifie :
  echo           pour t'en debarrasser, tape   npm uninstall -g xozhub
) else (
  echo           rien n'est modifie dans ce dossier.
  echo           utilise la commande  xoz  pour forcer la version de ce dossier.
)
goto :eof
