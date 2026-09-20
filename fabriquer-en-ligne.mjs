// XozHub.GPT — fabrique `install-en-ligne.ps1` : LE fichier qui contient tout.
//
//    node fabriquer-en-ligne.mjs
//
// Ce fichier est celui que la ligne d'installation telecharge :
//
//    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"
//
// Il contient :
//   - en clair  : les etapes d'installation (Node.js, PATH, raccourci, lancement) ;
//   - en chiffre : le code de l'agent (version protegee de fabriquer-protege.mjs),
//     package.json, xozhub.cmd et .env.
//
// Consequence : le depot n'a besoin d'AUCUN sous-dossier — ni bin/, ni src/,
// ni docs/. Ce seul fichier suffit, et l'installation ne telecharge rien
// d'autre : pas de .zip, pas de fins de ligne a reparer, pas de dossiers a
// reconstituer. C'est ce qui la rend impossible a rater.
//
// ⚠ Le fichier produit est un ARTEFACT : apres une modification du code, il
// faut le refabriquer (cette commande) et remonter le fichier sur le depot.
//
// Aucune dependance : uniquement Node.js.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fabriquerSourceProtegee } from './fabriquer-protege.mjs';

const racine = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(racine, 'install-en-ligne.ps1');
const CHUNK = 200;

// ---------------------------------------------------- 1. ce qu'on embarque

const protege = fabriquerSourceProtegee(racine);

const fichiers = [
  { p: 'bin/xozhub.js', d: Buffer.from(protege.source, 'utf8').toString('base64') },
];

for (const f of ['package.json', 'xozhub.cmd', 'banniere.ps1', '.env']) {
  const abs = path.join(racine, f);
  if (fs.existsSync(abs)) fichiers.push({ p: f, d: fs.readFileSync(abs).toString('base64') });
  else if (f === '.env') {
    console.log('  ATTENTION : pas de .env trouve — la cle X.GPT sera DEMANDEE a la personne.');
  }
}

const paquet = Buffer.from(JSON.stringify(fichiers), 'utf8').toString('base64');

// Empreinte du CONTENU embarque (et non du fichier produit) : elle est calculee
// sur les sources EN CLAIR, donc deux fabrications du meme code donnent la meme
// empreinte — alors que le chiffrement, lui, tire une cle differente a chaque
// fois. C'est ce qui permet a publier.cmd de verifier que le depot sert bien
// cette version-la : la taille, elle, ne prouve rien, puisque deux versions
// differentes pesent exactement le meme poids.
function empreinteContenu() {
  const h = crypto.createHash('sha256');
  const ajouter = (relatif, contenu) => {
    h.update(relatif.replace(/\\/g, '/') + '\n');
    h.update(crypto.createHash('sha256').update(contenu).digest('hex') + '\n');
  };
  const lister = (dossier) => {
    if (!fs.existsSync(dossier)) return;
    const entrees = fs.readdirSync(dossier, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entrees) {
      const abs = path.join(dossier, e.name);
      if (e.isDirectory()) lister(abs);
      else if (/\.js$/i.test(e.name)) ajouter(path.relative(racine, abs), fs.readFileSync(abs));
    }
  };
  lister(path.join(racine, 'bin'));
  lister(path.join(racine, 'src'));
  for (const f of ['package.json', 'xozhub.cmd', 'banniere.ps1', '.env']) {
    const abs = path.join(racine, f);
    if (fs.existsSync(abs)) ajouter(f, fs.readFileSync(abs));
  }
  return h.digest('hex').slice(0, 16);
}

const empreinte = empreinteContenu();

// Le bandeau n'est pas recopie a la main dans le fichier produit : on prend le
// corps de banniere.ps1 (sans sa ligne param, remplacee par le statut de
// l'installation). Une seule source de verite pour le dessin et les couleurs.
const banniere = fs
  .readFileSync(path.join(racine, 'banniere.ps1'), 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/^param\(.*\)$\n/m, "$Statut = 'En cours d''installation...'\n")
  .trimEnd();
// ⚠ Pas de virgule apres le DERNIER bloc : PowerShell refuse un tableau qui
// se termine par une virgule (@('a',) est une erreur).
const morceaux = paquet.match(new RegExp(`.{1,${CHUNK}}`, 'g')) || [];
const blocs = morceaux
  .map((b, i) => `'${b}'${i < morceaux.length - 1 ? ',' : ''}`)
  .join('\n');

// ------------------------------------------------------- 2. le script .ps1

const ps1 = `# =====================================================================
#  XozHub.GPT - installation en UNE SEULE LIGNE (Windows)
# =====================================================================
#
#  La personne ouvre une fenetre cmd, colle cette ligne, appuie Entree :
#
#    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"
#
#  C'est tout. CE FICHIER SUFFIT : le code de l'agent voyage dedans, chiffre.
#  Le depot n'a donc besoin d'aucun sous-dossier (ni bin/, ni src/), et rien
#  d'autre n'est telecharge pendant l'installation.
#
#  Ce qu'il fait, dans l'ordre :
#    1. il verifie Node.js 18+ (et propose de l'installer automatiquement) ;
#    2. il ecrit l'IA dans %LOCALAPPDATA%\\XozHub - le code y est CHIFFRE,
#       aucun script lisible n'est depose sur le disque ;
#    3. il ajoute la commande xozhub au PATH de l'utilisateur ;
#    4. il masque le dossier d'installation et pose le raccourci
#       XozHub.GPT sur le Bureau (double-clic = l'IA s'ouvre dans le terminal) ;
#    5. il lance l'IA.
#
#  AUCUNE QUESTION N'EST POSEE (sauf si Node.js manque, ou si aucune cle
#  n'a ete fournie) : la cle X.GPT commune voyage dans ce fichier.
#
#  ---------------------------------------------------------------------
#  FICHIER GENERE - ne pas modifier a la main.
#  Contenu embarque : ${empreinte}
#  Pour le refabriquer apres une modification du code :
#      node fabriquer-en-ligne.mjs
#  ---------------------------------------------------------------------
# =====================================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

$Nom = 'XozHub.GPT'

# Dossier d'installation. XOZHUB_INSTALL_DIR change la destination ET passe en
# « mode isole » : rien en dehors du dossier (ni PATH, ni raccourci). C'est ce
# qui permet de tester une installation sans rien toucher sur la machine.
if ($env:XOZHUB_INSTALL_DIR) { $Dossier = $env:XOZHUB_INSTALL_DIR; $isole = $true }
else { $Dossier = Join-Path $env:LOCALAPPDATA 'XozHub'; $isole = $false }

function Ecrire-Vide { Write-Host '' }
function Ecrire-Titre {
  param([string]$T)
  Write-Host ''
  Write-Host '   ============================================================' -ForegroundColor DarkCyan
  Write-Host "    $T" -ForegroundColor Cyan
  Write-Host '   ============================================================' -ForegroundColor DarkCyan
  Write-Host ''
}
function Ecrire-Etape { param([string]$N, [string]$T) Write-Host "   [$N] $T" -ForegroundColor White }
function Ecrire-Ok { param([string]$T) Write-Host "        $T" -ForegroundColor Green }
function Ecrire-Note { param([string]$T) Write-Host "        $T" -ForegroundColor DarkGray }
function Ecrire-Alerte { param([string]$T) Write-Host "        $T" -ForegroundColor Yellow }

function Stop-Lisible {
  param([string]$Message)
  Write-Host ''
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Red
  Write-Host "    $Message" -ForegroundColor Red
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Red
  Write-Host ''
  Write-Host "    Rien n'a ete casse : relance simplement la ligne."
  Write-Host "    Si ca recommence, envoie cette fenetre a la personne qui t'a donne $Nom."
  Write-Host ''
  try { [void](Read-Host '    Appuie sur Entree pour fermer') } catch { Start-Sleep -Seconds 10 }
  exit 1
}

Clear-Host -ErrorAction SilentlyContinue
${banniere}
Write-Host "    Installation automatique - tu n'as rien a taper." -ForegroundColor White
Write-Host '    Laisse cette fenetre ouverte, ca prend une minute.' -ForegroundColor DarkGray

# ------------------------------------------------------- 1/5  Node.js
Ecrire-Titre '1/5  Verification de Node.js'

# Node.js 18 (obligatoire) ne s'installe plus sur Windows 7 ni avant. Autant le
# dire clairement, plutot que d'envoyer la personne vers une installation qui
# echouera de toute facon. Au moindre doute, on ne bloque pas.
$osTropVieux = $false
$osMajeur = 0
$osMineur = 0
try {
  $cv = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion' -ErrorAction Stop
  if ($cv.CurrentMajorVersionNumber) { $osMajeur = [int]$cv.CurrentMajorVersionNumber }
  if ($cv.CurrentVersion) {
    $morceaux = $cv.CurrentVersion -split '\\.'
    if (-not $osMajeur -and $morceaux.Count -ge 2) { $osMajeur = [int]$morceaux[0] }
    if ($morceaux.Count -ge 2) { $osMineur = [int]$morceaux[1] }
  }
  if ($osMajeur -gt 0 -and ($osMajeur -lt 6 -or ($osMajeur -eq 6 -and $osMineur -lt 2))) { $osTropVieux = $true }
} catch {
  $osTropVieux = $false
}
if ($osTropVieux) {
  Stop-Lisible ("Ce PC est sous Windows " + $osMajeur + "." + $osMineur + " : $Nom demande Windows 8, 10 ou 11." +
    " La version de Node.js dont il a besoin ne s'installe pas sur cette version de Windows.")
}

$majeur = 0
if (Get-Command 'node' -ErrorAction SilentlyContinue) {
  try { $majeur = [int]((& node -p 'process.versions.node') -split '\\.')[0] } catch { $majeur = 0 }
}

if ($majeur -ge 18) {
  Ecrire-Ok "Node.js $majeur detecte - OK"
} else {
  Ecrire-Alerte "Node.js 18 ou plus est obligatoire pour faire tourner $Nom."
  $reponse = ''
  try { $reponse = Read-Host "    L'installer automatiquement avec winget ? [O/N]" } catch { $reponse = '' }

  if ($reponse -match '^[oOyY]' -and (Get-Command 'winget' -ErrorAction SilentlyContinue)) {
    Ecrire-Note 'Installation de Node.js LTS - cela peut prendre 1 a 2 minutes...'
    & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
    $dossier32 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    $env:Path = "$env:Path;$env:ProgramFiles\\nodejs;$dossier32\\nodejs"
    if (Get-Command 'node' -ErrorAction SilentlyContinue) {
      try { $majeur = [int]((& node -p 'process.versions.node') -split '\\.')[0] } catch { $majeur = 0 }
    }
  }

  if ($majeur -lt 18) {
    Stop-Lisible ("Installe Node.js 18 ou plus depuis https://nodejs.org puis relance la ligne." +
      " (Prends la version LTS : clique sur le bouton vert, puis Suivant jusqu'au bout.)")
  }
  Ecrire-Ok "Node.js $majeur detecte - OK"
}

# --------------------------------------------------- 2/5  les fichiers
Ecrire-Titre '2/5  Installation de XozHub.GPT'
Ecrire-Note "Dossier : $Dossier"

$blocs = @(
${blocs}
)

try {
  $json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($blocs -join '')))
  $contenu = ConvertFrom-Json $json
} catch {
  Stop-Lisible "Le fichier d'installation est incomplet ou abime. Relance la ligne pour le retelecharger."
}

try {
  New-Item -ItemType Directory -Force -Path $Dossier | Out-Null
  foreach ($f in $contenu) {
    $chemin = Join-Path $Dossier ($f.p -replace '/', '\\')
    $parent = Split-Path $chemin
    if ($parent -and -not (Test-Path $parent)) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
    [IO.File]::WriteAllBytes($chemin, [Convert]::FromBase64String($f.d))
  }
} catch {
  Stop-Lisible "Impossible d'ecrire les fichiers dans $Dossier ($($_.Exception.Message))."
}

if (-not (Test-Path (Join-Path $Dossier 'bin\\xozhub.js'))) {
  Stop-Lisible "L'installation est incomplete : bin\\xozhub.js n'a pas pu etre ecrit dans $Dossier."
}
Ecrire-Ok 'Fichiers installes - OK'

# Mise a jour d'une installation plus ancienne : les versions precedentes
# laissaient des scripts lisibles (src\\, install.cmd, ...). On les efface, pour
# que rien de lisible ne survive sur une machine deja installee. La liste est
# EXPLICITE : rien d'autre n'est jamais touche.
$anciens = @(
  'src', 'docs', '.tmp-qa',
  'install.cmd', 'install-en-ligne.ps1', 'install-depuis-le-depot.ps1',
  'xoz.cmd', 'link-dev.cmd', 'forcer.cmd', 'verifier.cmd', 'reparer.cmd', 'partager.cmd',
  'fabriquer.cmd', 'fabriquer-exe.cmd', 'fabriquer.ps1', 'fabriquer-exe.ps1',
  'fabriquer-en-ligne.mjs', 'fabriquer-installeur.mjs', 'fabriquer-protege.mjs',
  'corriger-crlf.mjs', 'publier.cmd', 'publier.ps1',
  'README.md', 'TUTORIEL.md', 'UNE-LIGNE.md', 'XozHub.md',
  '.xozhub-session.json', '.xozhub-linked'
)
$nettoyes = 0
foreach ($vieux in $anciens) {
  $chemin = Join-Path $Dossier $vieux
  if (Test-Path $chemin) {
    try { Remove-Item -LiteralPath $chemin -Recurse -Force; $nettoyes++ } catch { }
  }
}
if ($nettoyes -gt 0) { Ecrire-Ok "Ancienne version nettoyee ($nettoyes element(s)) - OK" }

# Si aucune cle n'a voyage, on la demande ici (une seule fois).
$fichierEnv = Join-Path $Dossier '.env'
$aCle = $false
if (Test-Path $fichierEnv) {
  $aCle = (Get-Content -Raw $fichierEnv) -match 'XOZHUB_API_KEY=\\S'
}
if (-not $aCle) {
  Ecrire-Alerte 'Aucune cle X.GPT fournie avec ce fichier.'
  $saisie = ''
  try { $saisie = Read-Host '    Colle ta cle X.GPT (xgpt_...), puis Entree' } catch { $saisie = '' }
  if ($saisie) {
    if (-not (Test-Path $fichierEnv)) { New-Item -ItemType File -Force -Path $fichierEnv | Out-Null }
    Add-Content -Path $fichierEnv -Value ("XOZHUB_API_KEY=" + $saisie.Trim())
    Ecrire-Ok 'Cle API enregistree - OK'
  } else {
    Ecrire-Alerte "Pas de cle pour l'instant : ecris la tienne dans $fichierEnv"
  }
} else {
  Ecrire-Ok "Cle X.GPT fournie : tu n'as rien a saisir - OK"
}

# ------------------------------------------------- 3/5  la commande xozhub
Ecrire-Titre '3/5  Commande "xozhub"'

if ($isole) {
  Ecrire-Note 'Mode isole : le PATH de la machine n est pas modifie.'
} else {
  $cheminUtilisateur = [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not $cheminUtilisateur) { $cheminUtilisateur = '' }
  if (($cheminUtilisateur -split ';') -notcontains $Dossier) {
    [Environment]::SetEnvironmentVariable(
      'Path',
      (($cheminUtilisateur.TrimEnd(';') + ';' + $Dossier).TrimStart(';')),
      'User')
    Ecrire-Ok 'PATH mis a jour - OK'
  } else {
    Ecrire-Ok 'Deja presente dans le PATH - OK'
  }
}

# --------------------------------------- 4/5  dossier masque + raccourci
Ecrire-Titre '4/5  Raccourci sur le Bureau'

if ($isole) {
  Ecrire-Note 'Mode isole : dossier non masque, pas de raccourci sur le Bureau.'
} else {
  try {
    $attributs = (Get-Item -LiteralPath $Dossier).Attributes
    (Get-Item -LiteralPath $Dossier).Attributes = $attributs -bor [IO.FileAttributes]::Hidden
    Ecrire-Ok 'Dossier d installation masque - OK'
  } catch {
    Ecrire-Note 'Dossier non masque (pas bloquant).'
  }

  try {
    $lien = Join-Path ([Environment]::GetFolderPath('Desktop')) "$Nom.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $raccourci = $shell.CreateShortcut($lien)
    $raccourci.TargetPath = Join-Path $Dossier 'xozhub.cmd'
    $raccourci.WorkingDirectory = $env:USERPROFILE
    $raccourci.IconLocation = "$env:SystemRoot\\System32\\cmd.exe,0"
    $raccourci.Description = "$Nom - agent de developpement"
    $raccourci.Save()
    Ecrire-Ok "Raccourci $Nom pose sur le Bureau - OK"
  } catch {
    Ecrire-Alerte 'Raccourci non cree (pas bloquant) : tape xozhub dans une nouvelle fenetre cmd.'
  }
}

# ------------------------------------------------------------ 5/5  fin
Ecrire-Titre '5/5  Installation terminee'
Write-Host '   ############################################################' -ForegroundColor Green
Write-Host '   #          INSTALLATION TERMINEE - BIENVENUE               #' -ForegroundColor Green
Write-Host '   ############################################################' -ForegroundColor Green
Write-Host ''
Write-Host "    Pour parler avec $Nom :" -ForegroundColor White
Write-Host ''
Write-Host '      1. clique sur l icone  XozHub.GPT  posee sur ton Bureau'
Write-Host '      2. ou ouvre une NOUVELLE fenetre cmd et tape :  xozhub'
Write-Host ''

$lancerMaintenant = 'O'
try { $lancerMaintenant = Read-Host '    Lancer XozHub.GPT maintenant ? [O/N]' } catch { $lancerMaintenant = 'N' }

if ($lancerMaintenant -match '^[oOyY]') {
  Start-Process -FilePath (Join-Path $Dossier 'xozhub.cmd')
} else {
  Write-Host ''
  Write-Host '    A bientot sur XozHub.GPT.' -ForegroundColor DarkGray
  Write-Host ''
}
`;

fs.writeFileSync(OUT, ps1, 'utf8');

// ------------------------------------------------------------ 3. resume

const ko = (Buffer.byteLength(ps1) / 1024).toFixed(0);
console.log('');
console.log(`  Fichier ecrit : ${OUT}`);
console.log(`  Taille        : ${ko} Ko  (${fichiers.length} fichiers embarques, code chiffre)`);
console.log(`  Modules       : ${protege.modules}`);
console.log(`  Contenu       : ${empreinte}   (empreinte du code embarque)`);
console.log('');
console.log('  La personne colle la ligne, et rien d autre :');
console.log('    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"');
console.log('');
console.log('  Pour la mettre a jour : remonte CE FICHIER sur le depot (un seul fichier).');
console.log('');
