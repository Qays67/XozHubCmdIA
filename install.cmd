@echo off
setlocal EnableExtensions
rem Ce fichier doit garder des fins de ligne CRLF (voir .gitattributes).
title XozHub.GPT - Installation

rem ===========================================================================
rem  XozHub.GPT - installateur Windows
rem
rem  A REGLER AVANT DE PARTAGER CE FICHIER :
rem    API_KEY : cle X.GPT commune (ou laisse un .env a cote de install.cmd).
rem              Laisse la ligne "set API_KEY" telle quelle pour que la cle soit
rem              DEMANDEE a la personne qui installe : aucune fuite possible.
rem    SRC_URL  : lien direct vers le .zip du projet, utilise SEULEMENT si les
rem              fichiers ne sont pas deja a cote de install.cmd
rem
rem  UTILISATION : coller cette ligne dans l'invite de commandes, ou double-clic.
rem ===========================================================================
set "API_KEY=xgpt_ta_cle_ici"
set "SRC_URL=https://github.com/Qays67/XozHubCmdIA/archive/refs/heads/main.zip"
set "INSTALL_DIR=%LOCALAPPDATA%\XozHub"
rem ===========================================================================

if not "%~1"=="" set "SRC_URL=%~1"
set "SELF_DIR=%~dp0"
set "SRC="
set "ENV_SRC="

cls
echo.
echo    ############################################################
echo    #                                                          #
echo    #             X O Z H U B . G P T                          #
echo    #        agent de developpement en ligne de commande       #
echo    #                                                          #
echo    ############################################################
echo.
echo    Installation automatique - suis les etapes.
echo.

rem --------------------------------------------------------------- 1. Node.js
echo   [1/6] Verification de Node.js...
where node >nul 2>nul
if errorlevel 1 goto :install_node
set "NODE_MAJOR="
for /f "delims=." %%v in ('node -p "process.versions.node" 2^>nul') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :install_node
if %NODE_MAJOR% GEQ 18 goto :node_ok

:install_node
echo.
echo   Node.js 18 ou plus est obligatoire pour faire tourner XozHub.GPT.
echo   Il est absent, ou trop ancien, sur cet ordinateur.
echo.
choice /c ON /n /m "  L'installer automatiquement avec winget ? [O/N] "
if errorlevel 2 goto :manual_node
where winget >nul 2>nul
if errorlevel 1 goto :manual_node
echo.
echo   Installation de Node.js LTS - cela peut prendre 1 a 2 minutes...
echo.
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
set "PATH=%PATH%;%ProgramFiles%\nodejs;%ProgramFiles(x86)%\nodejs"
where node >nul 2>nul
if errorlevel 1 goto :manual_node
set "NODE_MAJOR="
for /f "delims=." %%v in ('node -p "process.versions.node" 2^>nul') do set "NODE_MAJOR=%%v"
if not defined NODE_MAJOR goto :manual_node

:node_ok
echo         Node.js %NODE_MAJOR% detecte - OK
goto :step2

:manual_node
echo.
echo   ---------------------------------------------------------------
echo    Installe Node.js 18 ou plus depuis  https://nodejs.org
echo    puis relance ce fichier : le reste se fera tout seul.
echo   ---------------------------------------------------------------
echo.
pause
exit /b 1

rem ------------------------------------------------------- 2. fichiers source
:step2
echo.
echo   [2/6] Recuperation des fichiers de XozHub.GPT...
if exist "%SELF_DIR%bin\xozhub.js" set "SRC=%SELF_DIR%"
if not defined SRC for /d %%d in ("%SELF_DIR%*") do if exist "%%d\bin\xozhub.js" set "SRC=%%d\"
if defined SRC (
  echo         Fichiers trouves a cote de l'installateur - OK
  goto :step3
)
echo         Telechargement depuis %SRC_URL%
set "ZIP=%TEMP%\xozhub-src.zip"
set "EXTRACT=%TEMP%\xozhub-src"
if exist "%ZIP%" del /q "%ZIP%" >nul 2>nul
if exist "%EXTRACT%" rd /s /q "%EXTRACT%" >nul 2>nul
where curl.exe >nul 2>nul
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol='Tls12'; Invoke-WebRequest -Uri '%SRC_URL%' -OutFile '%ZIP%'"
) else (
  curl.exe -L --fail --silent --show-error -o "%ZIP%" "%SRC_URL%"
)
if not exist "%ZIP%" goto :dl_fail
mkdir "%EXTRACT%" >nul 2>nul
tar -xf "%ZIP%" -C "%EXTRACT%" >nul 2>nul
if errorlevel 1 powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%ZIP%' -DestinationPath '%EXTRACT%' -Force" >nul 2>nul
for /d %%d in ("%EXTRACT%\*") do if exist "%%d\bin\xozhub.js" set "SRC=%%d\"
if not defined SRC if exist "%EXTRACT%\bin\xozhub.js" set "SRC=%EXTRACT%\"
if not defined SRC goto :dl_fail
echo         Fichiers prets - OK
goto :step3

:dl_fail
echo.
echo   ---------------------------------------------------------------
echo    Impossible de recuperer les fichiers de XozHub.GPT.
echo    Verifie ta connexion internet, ou ouvre le dossier du projet
echo    et double-clique sur install.cmd depuis ce dossier.
echo    Lien utilise : "%SRC_URL%"
echo   ---------------------------------------------------------------
echo.
pause
exit /b 1

rem --------------------------------------------------------- 3. copie du projet
:step3
echo.
echo   [3/6] Installation dans %INSTALL_DIR%...
if not exist "%INSTALL_DIR%\bin" mkdir "%INSTALL_DIR%\bin" >nul 2>nul
xcopy "%SRC%bin" "%INSTALL_DIR%\bin" /E /I /Y /Q >nul
xcopy "%SRC%src" "%INSTALL_DIR%\src" /E /I /Y /Q >nul
copy /Y "%SRC%package.json" "%INSTALL_DIR%\package.json" >nul
copy /Y "%SRC%xozhub.cmd" "%INSTALL_DIR%\xozhub.cmd" >nul
rem Le reste (README, install.cmd, scripts de developpement) n'est PAS recopie :
rem ce sont des scripts, ils n'ont rien a faire chez la personne qui installe.
if exist "%SRC%fabriquer-protege.mjs" copy /Y "%SRC%fabriquer-protege.mjs" "%INSTALL_DIR%\fabriquer-protege.mjs" >nul
if not exist "%INSTALL_DIR%\bin\xozhub.js" goto :copy_fail
echo         Fichiers installes - OK
goto :protection

rem --------------------- 3b. code protege : UN SEUL fichier, illisible
:protection
rem Le code est rassemble en un seul fichier chiffre, puis les sources sont
rem effacees : la personne qui installe n'a aucun script lisible a recopier.
if not exist "%INSTALL_DIR%\fabriquer-protege.mjs" goto :sans_protection
echo         Protection du code (rassemblement + chiffrement)...
node "%INSTALL_DIR%\fabriquer-protege.mjs" "%INSTALL_DIR%" "%INSTALL_DIR%\bin\xozhub.js" --remplacer >nul 2>nul
if errorlevel 1 goto :protection_ratee
rd /s /q "%INSTALL_DIR%\src" >nul 2>nul
del /q "%INSTALL_DIR%\fabriquer-protege.mjs" >nul 2>nul
if exist "%INSTALL_DIR%\src" goto :protection_ratee
if not exist "%INSTALL_DIR%\bin\xozhub.js" goto :protection_ratee
echo         Code protege : plus aucun script lisible - OK
goto :step4

:protection_ratee
echo         ATTENTION : protection impossible. L'IA marche, mais le code reste lisible.
goto :step4

:sans_protection
echo         ATTENTION : fabriquer-protege.mjs absent de l'archive - code non protege.
goto :step4

:copy_fail
echo.
echo   ---------------------------------------------------------------
echo    L'installation a echoue : fichiers incomplets.
echo    Essai d'ecriture dans : %INSTALL_DIR%
echo   ---------------------------------------------------------------
echo.
pause
exit /b 1

rem ------------------------------------------------------------ 4. cle API
:step4
echo.
echo   [4/6] Configuration de la cle API...
if exist "%SELF_DIR%.env" set "ENV_SRC=%SELF_DIR%.env"
if not defined ENV_SRC if exist "%SRC%.env" set "ENV_SRC=%SRC%.env"
if defined ENV_SRC (
  copy /Y "%ENV_SRC%" "%INSTALL_DIR%\.env" >nul
  echo         Cle reprise du fichier .env fourni - OK
  goto :step5
)
if /i not "%API_KEY%"=="xgpt_ta_cle_ici" goto :cle_fournie
echo.
echo         Aucune cle fournie avec l'installateur.
echo         Colle ta cle X.GPT (xgpt_...) puis appuie sur Entree.
echo         (Entree sans rien coller : la cle sera a completer plus tard)
set "API_KEY="
set /p "API_KEY=  Cle X.GPT : "

:cle_fournie
if not defined API_KEY goto :cle_absente
> "%INSTALL_DIR%\.env" echo XOZHUB_API_KEY=%API_KEY%
echo         Cle API installee - OK
goto :cle_fin

:cle_absente
> "%INSTALL_DIR%\.env" echo XOZHUB_API_KEY=
echo         Pas de cle pour l'instant. Ecris la tienne dans :
echo         %INSTALL_DIR%\.env

:cle_fin
>> "%INSTALL_DIR%\.env" echo XOZHUB_BASE_URL=https://xgpt-api.xshe.workers.dev/v1
>> "%INSTALL_DIR%\.env" echo XOZHUB_MODEL=xgpt-code

rem ------------------------------------------------------------- 5. commande
:step5
echo.
echo   [5/6] Creation de la commande "xozhub"...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$d='%INSTALL_DIR%'; $p=[Environment]::GetEnvironmentVariable('Path','User'); if(-not $p){$p=''}; if(($p -split ';') -notcontains $d){ [Environment]::SetEnvironmentVariable('Path', (($p.TrimEnd(';') + ';' + $d).TrimStart(';')), 'User'); exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo         Deja presente dans le PATH - OK
) else (
  echo         PATH mis a jour - OK
)
rem Dossier masque : la personne ne voit que l'icone du Bureau, pas les fichiers.
attrib +h "%INSTALL_DIR%" >nul 2>nul
echo         Dossier d'installation masque - OK

rem ------------------------------------------------------- 6. raccourci Bureau
:step6
echo.
echo   [6/6] Raccourci "XozHub.GPT" sur le Bureau...
rem Le raccourci vise directement xozhub.cmd dans le dossier d'installation : il marche donc
rem meme si le PATH de Windows n'a pas encore ete rafraichi. Il s'ouvre dans une fenetre cmd.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $d='%INSTALL_DIR%'; $p=Join-Path ([Environment]::GetFolderPath('Desktop')) 'XozHub.GPT.lnk'; $w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($p); $s.TargetPath=Join-Path $d 'xozhub.cmd'; $s.WorkingDirectory='%USERPROFILE%'; $s.IconLocation='%SystemRoot%\System32\cmd.exe,0'; $s.Description='XozHub.GPT - agent de developpement'; $s.Save(); exit 0 } catch { exit 1 }"
if errorlevel 1 (
  echo         Raccourci non cree - pas bloquant, l'IA est installee.
) else (
  echo         Raccourci cree : double-clic dessus pour lancer l'IA - OK
)

echo.
echo    ############################################################
echo    #          INSTALLATION TERMINEE - BIENVENUE               #
echo    ############################################################
echo.
echo    Pour parler avec XozHub.GPT :
echo.
echo      1. Double-clique sur l'icone  XozHub.GPT  posee sur ton Bureau
echo      2. Ou ouvre une NOUVELLE fenetre : touche Windows, tape  cmd , Entree
echo      3. Tape   xozhub   puis appuie sur Entree
echo.
echo    Ensuite, la commande  xozhub  marche depuis n'importe quel dossier.
echo.
choice /c ON /n /m "  Lancer XozHub.GPT maintenant ? [O/N] "
if errorlevel 2 goto :done
start "XozHub.GPT" "%INSTALL_DIR%\xozhub.cmd"

:done
echo.
echo    A bientot sur XozHub.GPT.
timeout /t 5 >nul 2>nul
exit /b 0
