@echo off
rem XozHub.GPT - fabrique l'installateur .exe (XozHub-GPT-Setup.exe).
rem Double-clic. Ce fichier est volontairement minuscule et lineaire :
rem il marche que ses fins de ligne soient en CRLF ou en LF.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fabriquer-exe.ps1"
pause
