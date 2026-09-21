@echo off
rem XozHub.AI - fabrique l'installateur .exe (XozHub-AI-Setup.exe).
rem Double-clic. Fichier volontairement minuscule : il marche que ses fins de
rem ligne soient en CRLF ou en LF.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0fabriquer-exe.ps1"
pause
