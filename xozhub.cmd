@echo off
setlocal EnableExtensions

rem XozHub.GPT - lanceur.
rem
rem Ce fichier est volontairement LINEAIRE : aucune etiquette, aucun goto,
rem aucun bloc entre parentheses. C'est ce qui le rend robuste : cmd.exe se
rem trompe de position des qu'il croise un goto ou un if ( ... ) dans un
rem fichier dont les fins de ligne sont en LF (style Unix) et se met a executer
rem des morceaux de lignes. Ici, il n'y a rien de tel, donc le lanceur marche
rem que le fichier soit en LF ou en CRLF.

rem --- Node.js present ? (messages affiches seulement s'il manque) ---
where node >nul 2>nul || echo.
where node >nul 2>nul || echo   XozHub.GPT a besoin de Node.js 18 ou plus.
where node >nul 2>nul || echo   Installe-le depuis https://nodejs.org puis relance ce fichier.
where node >nul 2>nul || pause
where node >nul 2>nul || exit /b 1

rem --- Lancement de l'interface ---
node "%~dp0bin\xozhub.js" %*
exit /b %errorlevel%
