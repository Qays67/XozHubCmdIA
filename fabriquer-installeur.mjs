// XozHub.GPT — fabrique UN SEUL fichier a envoyer aux potes.
//
// Usage :  node fabriquer-installeur.mjs
//
// Ce script lit le projet (bin/, src/, package.json, xozhub.cmd, .env...) et
// produit un fichier unique :  XozHub-GPT-Installer.cmd
//
// Ce fichier contient TOUT (code + .env avec la cle API). La personne qui le
// recoit n'a aucun dossier a gerer : elle double-clique, l'IA s'installe dans
// %LOCALAPPDATA%\XozHub, la commande xozhub est ajoutee au PATH, une icone
// XozHub.GPT est posee sur le Bureau, et une nouvelle fenetre cmd s'ouvre avec
// l'interface.
//
// Le code embarque est la version PROTEGEE (un seul fichier chiffre, voir
// fabriquer-protege.mjs) : rien de lisible n'arrive chez la personne, et aucun
// script de developpement n'est depose.
//
// Aucune dependance. Le fichier produit fonctionne meme si ses fins de ligne
// changent : il est volontairement lineaire (aucun goto, aucun bloc if).
// En cas d'echec il affiche l'erreur et attend une touche (pas de fenetre qui
// disparait trop vite).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fabriquerSourceProtegee } from './fabriquer-protege.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(root, 'XozHub-GPT-Installer.cmd');
const CHUNK = 100;

// ------------------------------------------------------------------ 1. paquet

// Rien d'autre que ces quatre fichiers : pas de README, pas de install.cmd, et
// surtout pas de src/ (le code part sous forme protegee, juste en dessous).
const relFiles = ['package.json', 'xozhub.cmd', '.env'];

const files = [];
for (const rel of relFiles) {
  const abs = path.join(root, rel);
  let buf;
  try {
    buf = fs.readFileSync(abs);
  } catch {
    if (rel === '.env') console.log('  ATTENTION : pas de .env trouve, la cle API manquera.');
    continue;
  }
  files.push({ p: rel, d: buf.toString('base64') });
}

// ------------------------------------------------- 1b. code protege (chiffre)
// Le code de l'agent n'est jamais depose en clair : il est rassemble en un
// seul fichier, chiffre, et c'est ce fichier que l'installeur ecrit.
let protege;
try {
  protege = fabriquerSourceProtegee(root);
} catch (err) {
  console.error('  ERREUR : impossible de fabriquer la version protegee — ' + err.message);
  process.exit(1);
}
files.push({ p: 'bin/xozhub.js', d: Buffer.from(protege.source, 'utf8').toString('base64') });
console.log('  Code protege : ' + protege.modules + ' modules rassembles, ' +
  (Buffer.byteLength(protege.source) / 1024).toFixed(0) + ' Ko illisibles');

const payload = Buffer.from(JSON.stringify(files), 'utf8').toString('base64');
const chunks = payload.match(new RegExp('.{1,' + CHUNK + '}', 'g')) || [];

// Les deux commandes PowerShell de l'installateur.
const PS_DECODE =
  'powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference=\'Stop\'; ' +
  '$p=Join-Path $env:TEMP \'xozhub-payload.b64\'; $t=Get-Content -Raw $p; ' +
  '$j=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($t)); $a=ConvertFrom-Json $j; ' +
  '$d=Join-Path $env:LOCALAPPDATA \'XozHub\'; New-Item -ItemType Directory -Force -Path $d | Out-Null; ' +
  'foreach($f in $a){ $fp=Join-Path $d ($f.p -replace \'/\',\'\\\'); $par=Split-Path $fp; ' +
  'New-Item -ItemType Directory -Force -Path $par | Out-Null; ' +
  '[IO.File]::WriteAllBytes($fp,[Convert]::FromBase64String($f.d)) }; \'OK\'"';

const PS_SHORTCUT =
  'powershell -NoProfile -ExecutionPolicy Bypass -Command "try { ' +
  "$p=Join-Path ([Environment]::GetFolderPath(\'Desktop\')) \'XozHub.GPT.lnk\'; " +
  "$w=New-Object -ComObject WScript.Shell; $s=$w.CreateShortcut($p); " +
  "$s.TargetPath=Join-Path (Join-Path $env:LOCALAPPDATA \'XozHub\') \'xozhub.cmd\'; " +
  "$s.WorkingDirectory=$env:USERPROFILE; " +
  "$s.IconLocation=($env:SystemRoot + \'\\System32\\cmd.exe,0\'); " +
  "$s.Description=\'XozHub.GPT - agent de developpement\'; $s.Save() } catch { }";

const PS_PATH =
  'powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=Join-Path $env:LOCALAPPDATA \'XozHub\'; ' +
  '$p=[Environment]::GetEnvironmentVariable(\'Path\',\'User\'); if(-not $p){$p=\'\'}; ' +
  'if(($p -split \';\') -notcontains $d){ [Environment]::SetEnvironmentVariable(\'Path\', ' +
  '(($p.TrimEnd(\';\')+\';\'+$d).TrimStart(\';\')), \'User\') }"';

// --------------------------------------------------------------- 2. le .cmd

const L = [];
const push = (...lines) => lines.forEach((l) => L.push(l));

push(
  '@echo off',
  'setlocal EnableExtensions',
  'title XozHub.GPT - Installation',
  '',
  'echo.',
  'echo    ==========================================================',
  'echo     X O Z H U B . G P T   -   installation automatique',
  'echo    ==========================================================',
  'echo.',
  '',
  'where node >nul 2>nul || echo   XozHub.GPT a besoin de Node.js 18 ou plus.',
  'where node >nul 2>nul || echo   Installe-le depuis https://nodejs.org puis relance ce fichier.',
  'where node >nul 2>nul || pause',
  'where node >nul 2>nul || exit /b 1',
  '',
  'echo   [1/4] Ecriture des fichiers...',
  '',
  'set "PAYLOAD=%TEMP%\\xozhub-payload.b64"',
  'if exist "%PAYLOAD%" del /q "%PAYLOAD%"',
);

for (const c of chunks) L.push('>>"%PAYLOAD%" echo ' + c);

push(
  '',
  'echo   [2/4] Installation dans %LOCALAPPDATA%\\XozHub...',
  '',
  PS_DECODE,
  'if errorlevel 1 echo   ERREUR : impossible d ecrire les fichiers de XozHub.GPT.',
  'if errorlevel 1 pause',
  'if errorlevel 1 exit /b 1',
  'if not exist "%LOCALAPPDATA%\\XozHub\\bin\\xozhub.js" echo   ERREUR : installation incomplete (bin\\xozhub.js manquant).',
  'if not exist "%LOCALAPPDATA%\\XozHub\\bin\\xozhub.js" pause',
  'if not exist "%LOCALAPPDATA%\\XozHub\\bin\\xozhub.js" exit /b 1',
  '',
  PS_PATH,
  '',
  'rem Dossier masque : la personne ne voit que l\'icone du Bureau.',
  'attrib +h "%LOCALAPPDATA%\\XozHub" >nul 2>nul',
  '',
  'echo   [3/4] Raccourci "XozHub.GPT" sur le Bureau...',
  PS_SHORTCUT,
  '',
  'if exist "%PAYLOAD%" del /q "%PAYLOAD%" >nul 2>nul',
  '',
  'echo   [4/4] Installation terminee. Ouverture de XozHub.GPT...',
  'echo.',
  'start "XozHub.GPT" "%LOCALAPPDATA%\\XozHub\\xozhub.cmd"',
  'exit /b 0',
);

// Fins de ligne CRLF explicites : le fichier reste correct meme transfere brut.
fs.writeFileSync(OUT, L.join('\r\n') + '\r\n', 'utf8');

// ------------------------------------------------------------------ 3. resume

const ko = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log('');
console.log('  Fichier cree : ' + OUT);
console.log('  Taille       : ' + ko + ' Ko  (' + files.length + ' fichiers embarques)');
console.log('');
console.log('  Tu envoies CE fichier a tes potes. De leur cote :');
console.log('    1. ils le recoivent (Discord, mail, cle USB...)');
console.log('    2. ils double-cliquent dessus');
console.log('    3. l\'IA s\'installe et une fenetre XozHub.GPT s\'ouvre');
console.log('');
console.log('  Ensuite, dans une nouvelle fenetre cmd, la commande  xozhub  marche.');
console.log('');
