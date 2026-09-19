@echo off
rem Alias court : lance toujours la version de ce dossier,
rem meme si une autre commande " xozhub " existe ailleurs sur la machine.
call "%~dp0xozhub.cmd" %*
