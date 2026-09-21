# XozHub.AI - installation dans %LOCALAPPDATA%\XozHubAI
#
# Appele par l'installateur .exe (XozHub-AI-Setup.exe), apres extraction du
# paquet dans un dossier temporaire. Le dossier extrait contient deja :
#   ia\   (le serveur, l'interface, le lanceur)
#   src\  (le moteur : API, ecriture des fichiers, execution des commandes)
#   .env  (la cle, pour que la personne n'ait rien a saisir)
#
# Aucun accent dans ce fichier : PowerShell 5.1 lit les .ps1 sans BOM en ANSI,
# et les accents y deviennent illisibles.

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

$Source = Split-Path -Parent $PSScriptRoot          # le dossier extrait
$Cible  = Join-Path $env:LOCALAPPDATA 'XozHubAI'    # ou l'IA va vivre
$NodeMin = 18

function Titre([string]$Texte) {
  Write-Host ''
  Write-Host '  ==========================================================' -ForegroundColor DarkMagenta
  Write-Host "   $Texte" -ForegroundColor Magenta
  Write-Host '  ==========================================================' -ForegroundColor DarkMagenta
  Write-Host ''
}
function Etape([string]$Texte) { Write-Host "   $Texte" -ForegroundColor White }
function Ok([string]$Texte)    { Write-Host "      $Texte" -ForegroundColor Green }
function Note([string]$Texte)  { Write-Host "      $Texte" -ForegroundColor DarkGray }
function Alerte([string]$Texte){ Write-Host "      $Texte" -ForegroundColor Yellow }

function Fin([string]$Message) {
  Write-Host ''
  Write-Host '  ----------------------------------------------------------' -ForegroundColor Red
  Write-Host "   $Message" -ForegroundColor Red
  Write-Host '  ----------------------------------------------------------' -ForegroundColor Red
  Write-Host ''
  Write-Host '   Rien n''a ete casse. Corrige ce qui est indique, puis'
  Write-Host '   relance XozHub-AI-Setup.exe.'
  Write-Host ''
  try { [void](Read-Host '   Appuie sur Entree pour fermer') } catch { Start-Sleep -Seconds 20 }
  exit 1
}

Clear-Host -ErrorAction SilentlyContinue
Titre 'XozHub.AI - installation'

if (-not (Test-Path (Join-Path $Source 'ia\serveur.mjs'))) {
  Fin 'Le paquet est incomplet : ia\serveur.mjs est introuvable.'
}

# ---------------------------------------------------------------- 1) Node.js
Etape '[1/4] Verification de Node.js'

function Version-Node {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $cmd) { return 0 }
  try {
    $v = (& node -v) -replace '^v', ''
    return [int]($v.Split('.')[0])
  } catch { return 0 }
}

$majeur = Version-Node
if ($majeur -ge $NodeMin) {
  Ok "Node.js $majeur est deja installe."
} else {
  Alerte "Node.js $NodeMin ou plus est necessaire (trouve : $majeur)."
  $winget = Get-Command winget -ErrorAction SilentlyContinue
  if ($winget) {
    Note 'Installation automatique de Node.js LTS (Windows peut demander une autorisation)...'
    try {
      & winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements --silent
    } catch {
      Alerte "L'installation automatique a echoue."
    }
    # Le PATH de cette fenetre date d'avant l'installation : on le relit.
    $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
    $majeur = Version-Node
  }
  if ($majeur -lt $NodeMin) {
    Alerte 'Node.js manque toujours.'
    Note 'Le telechargement de la version LTS va s''ouvrir dans le navigateur.'
    try { Start-Process 'https://nodejs.org/fr' } catch { }
    Fin 'Installe Node.js (bouton LTS), puis relance XozHub-AI-Setup.exe.'
  }
  Ok "Node.js $majeur installe."
}

# ---------------------------------------------------------------- 2) les fichiers
Etape '[2/4] Installation des fichiers'
if (-not (Test-Path $Cible)) { New-Item -ItemType Directory -Path $Cible -Force | Out-Null }

foreach ($dossier in @('ia', 'src')) {
  $arrivee = Join-Path $Cible $dossier
  if (Test-Path $arrivee) { Remove-Item $arrivee -Recurse -Force }
  Copy-Item (Join-Path $Source $dossier) -Destination $Cible -Recurse -Force
}
foreach ($fichier in @('package.json', '.env')) {
  $depart = Join-Path $Source $fichier
  if (Test-Path $depart) { Copy-Item $depart -Destination $Cible -Force }
}
Note $Cible
Ok 'Fichiers installes.'
if (-not (Test-Path (Join-Path $Cible '.env'))) {
  Alerte 'Pas de fichier .env : l''IA demandera une cle a la personne.'
}

# ---------------------------------------------------------------- 3) les raccourcis
Etape '[3/4] Raccourci sur le Bureau'

# Lanceur visible (une fenetre cmd s'ouvre, pratique pour voir les messages).
$cmd = @'
@echo off
setlocal EnableExtensions
title XozHub.AI
cd /d "%~dp0"
node "ia\serveur.mjs"
if errorlevel 1 (
  echo.
  echo    XozHub.AI n'a pas pu demarrer. Node.js est-il installe ?
  echo    Installe-le depuis nodejs.org ^(version LTS^), puis relance XozHub.AI.
  echo.
  pause
)
'@
Set-Content -Path (Join-Path $Cible 'xozhub-ai.cmd') -Value $cmd -Encoding ASCII

try {
  $ws = New-Object -ComObject WScript.Shell
  $lien = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'XozHub.AI.lnk'))
  $lien.TargetPath = (Join-Path $env:SystemRoot 'System32\wscript.exe')
  $lien.Arguments = '"' + (Join-Path $Cible 'ia\lancer.vbs') + '"'
  $lien.WorkingDirectory = $Cible
  $lien.Description = 'XozHub.AI - l''IA de developpement, en fenetre graphique'
  # L'icone de la galaxie, celle qui est dessinee par ia/fabriquer-icone.mjs :
  # c'est elle qu'on voit sur le Bureau, et dans la barre des taches.
  $icone = Join-Path $Cible 'ia\xozhub-ai.ico'
  if (Test-Path $icone) { $lien.IconLocation = $icone } else { $lien.IconLocation = "$env:SystemRoot\System32\shell32.dll,13" }
  $lien.Save()
  Ok 'Raccourci XozHub.AI pose sur le Bureau, avec le logo galaxie.'
} catch {
  Alerte 'Le raccourci du Bureau n''a pas pu etre cree.'
  Note "Utilise alors : $Cible\xozhub-ai.cmd"
}

# ---------------------------------------------------------------- 4) lancement
Etape '[4/4] Lancement'
try {
  Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\wscript.exe') `
    -ArgumentList ('"' + (Join-Path $Cible 'ia\lancer.vbs') + '"') | Out-Null
  Ok 'XozHub.AI demarre : sa fenetre va s''ouvrir.'
} catch {
  Alerte 'Le lancement automatique a echoue.'
  Note "Double-clique sur le raccourci XozHub.AI, ou lance : $Cible\xozhub-ai.cmd"
}

Write-Host ''
Write-Host '  ----------------------------------------------------------' -ForegroundColor DarkMagenta
Write-Host '   C''est installe. La prochaine fois, double-clique' -ForegroundColor Magenta
Write-Host '   simplement sur le raccourci XOZHUB.AI du Bureau.' -ForegroundColor Magenta
Write-Host '  ----------------------------------------------------------' -ForegroundColor DarkMagenta
Write-Host ''
Start-Sleep -Seconds 3
