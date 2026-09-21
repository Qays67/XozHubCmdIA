@echo off
rem XozHub.AI - lance l'IA depuis ce dossier (developpement).
rem Pour la version donnee aux autres, utilise plutot fabriquer-exe.cmd :
rem elle installe l'IA proprement et pose un raccourci sur le Bureau.
cd /d "%~dp0.."
if not exist "ia\serveur.mjs" (
  echo    ERREUR : ia\serveur.mjs est introuvable.
  pause
  exit /b 1
)
node "ia\serveur.mjs"
if errorlevel 1 (
  echo.
  echo    XozHub.AI n'a pas pu demarrer. Node.js est-il installe ?
  echo.
  pause
)
