@echo off
setlocal EnableExtensions
rem Ce fichier doit garder des fins de ligne CRLF (voir .gitattributes).
title XozHub.GPT - installation unique depuis le dossier du projet

set "PROJECT=%~dp0"
set "OLD_COPY=%LOCALAPPDATA%\XozHub"

echo.
echo    ############################################################
echo    #   XozHub.GPT - utiliser CE dossier comme seule version    #
echo    ############################################################
echo.
echo    Dossier du projet : %PROJECT%
echo.

rem 1) le dossier du projet entre dans le PATH utilisateur
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=('%PROJECT%').TrimEnd('\'); $p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; if(($p -split ';') -notcontains $d){ [Environment]::SetEnvironmentVariable('Path', (($p.TrimEnd(';') + ';' + $d).TrimStart(';')), 'User'); exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo   [1/3] Dossier deja dans le PATH - OK
) else (
  echo   [1/3] Dossier du projet ajoute au PATH - OK
)

rem 2) on supprime l'ancienne copie creee par install.cmd
if exist "%OLD_COPY%\bin\xozhub.js" (
  rmdir /s /q "%OLD_COPY%"
  echo   [2/3] Ancienne copie supprimee : %OLD_COPY%
) else (
  echo   [2/3] Aucune ancienne copie a supprimer - OK
)

rem 3) on nettoie son entree dans le PATH
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=('%OLD_COPY%').TrimEnd('\'); $p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; $a=@(); foreach($x in ($p -split ';')){ if($x -and $x -ne $d){ $a += $x } }; [Environment]::SetEnvironmentVariable('Path', ($a -join ';'), 'User')"
echo   [3/3] PATH nettoye - OK

echo.
echo    ############################################################
echo    #                        C'EST PRET                         #
echo    ############################################################
echo.
echo    Ouvre une NOUVELLE fenetre : touche Windows, tape  cmd , Entree
echo    Place-toi dans n'importe quel dossier et tape :   xozhub
echo.
echo    La commande pointe directement sur %PROJECT%
echo    Donc chaque modification du code s'applique tout de suite,
echo    sans rien reinstaller. C'est la meme IA que dans ce dossier.
echo.
pause
exit /b 0
