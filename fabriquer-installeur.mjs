// XozHub.GPT — fabrique UN SEUL fichier a envoyer aux potes.
//
// Usage :  node fabriquer-installeur.mjs
//
// Ce script lit le projet (bin/, src/, package.json, xozhub.cmd, .env...) et
// produit un fichier unique :  XozHub-GPT-Installer.cmd
//
// Ce fichier contient TOUT (code + .env avec la cle API). La personne qui le
// recoit n'a aucun dossier a gerer : elle double-clique, l'IA s'installe dans
// %LOCALAPPDATA%\XozHub, la commande xozhub est ajoutee au PATH, et une
// nouvelle fenetre cmd s'ouvre avec l'interface.
//
// Aucune dependance. Le fichier produit fonctionne meme si ses fins de ligne
// changent : il est volontairement lineaire (aucun goto, aucun bloc if).
// En cas d'echec il affiche l'erreur et attend une touche (pas de fenetre qui
// disparait trop vite).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(root, 'XozHub-GPT-Installer.cmd');
const CHUNK = 100;

// ------------------------------------------------------------------ 1. paquet

const relFiles = ['package.json', 'README.md', 'xozhub.cmd', '.env'];
for (const dir of ['bin', 'src']) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    if (name.endsWith('.js')) relFiles.push(dir + '/' + name);
  }
}

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
  'echo   [1/3] Ecriture des fichiers...',
  '',
  'set "PAYLOAD=%TEMP%\\xozhub-payload.b64"',
  'if exist "%PAYLOAD%" del /q "%PAYLOAD%"',
);

for (const c of chunks) L.push('>>"%PAYLOAD%" echo ' + c);

push(
  '',
  'echo   [2/3] Installation dans %LOCALAPPDATA%\\XozHub...',
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
  'if exist "%PAYLOAD%" del /q "%PAYLOAD%" >nul 2>nul',
  '',
  'echo   [3/3] Installation terminee. Ouverture de XozHub.GPT...',
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
