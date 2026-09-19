# =====================================================================
#  XozHub.GPT - publier la ligne d'installation sur GitHub
# =====================================================================
#
#  A quoi ca sert
#  --------------
#  La ligne que tu donnes a tout le monde telecharge UN SEUL fichier :
#
#     https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1
#
#  Tant que ce fichier, sur le depot, est l'ANCIENNE version (celle qui
#  telecharge bin/ et src/), la ligne echoue avec un message du genre
#  " Le projet telecharge est INCOMPLET ". Ce script met le depot a jour.
#
#  Ce qu'il fait, dans l'ordre :
#    1. il refabrique install-en-ligne.ps1 (node fabriquer-en-ligne.mjs) ;
#    2. il recolte la version du depot dans un dossier temporaire ;
#    3. il y copie le projet tel qu'il est dans ce dossier ;
#    4. il enregistre la version ;
#    5. il l'envoie sur GitHub (une fenetre GitHub peut s'ouvrir la
#       PREMIERE fois : connecte-toi, c'est une seule fois) ;
#    6. il verifie que le depot sert bien le NOUVEAU fichier.
#
#  Utilisation : double-clic sur publier.cmd
#
#  Aucune dependance : git et node, deja utilises par le projet.
# =====================================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch { }

# ------------------------------------------------------------ reglages
# Si tu renommes ton depot : change ces deux lignes, et rien d'autre.
$Depot   = 'Qays67/XozHubCmdIA'   # proprietaire/nom du depot GitHub
$Branche = 'main'                 # branche utilisee (un depot prive ne marche pour personne)

$Projet   = $PSScriptRoot
$Artefact = Join-Path $Projet 'install-en-ligne.ps1'
$Adresse  = "https://raw.githubusercontent.com/$Depot/$Branche/install-en-ligne.ps1"
$Ligne    = "powershell -NoProfile -ExecutionPolicy Bypass -Command `"irm $Adresse | iex`""
$Tour     = Join-Path $env:TEMP 'xozhub-publier'
$DepotUrl = "https://github.com/$Depot.git"

# ------------------------------------------------------------- affichage
function Ecrire-Vide { Write-Host '' }
function Ecrire-Titre {
  param([string]$Texte)
  Write-Host ''
  Write-Host '   ============================================================' -ForegroundColor DarkCyan
  Write-Host "    $Texte" -ForegroundColor Cyan
  Write-Host '   ============================================================' -ForegroundColor DarkCyan
  Write-Host ''
}
function Ecrire-Etape { param([string]$Num, [string]$Texte) Write-Host "   [$Num/6] $Texte" -ForegroundColor White }
function Ecrire-Ok { param([string]$Texte) Write-Host "          $Texte" -ForegroundColor Green }
function Ecrire-Note { param([string]$Texte) Write-Host "          $Texte" -ForegroundColor DarkGray }
function Ecrire-Alerte { param([string]$Texte) Write-Host "          $Texte" -ForegroundColor Yellow }

function Stop-Lisible {
  param([string]$Message)
  Write-Host ''
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Red
  Write-Host "    $Message" -ForegroundColor Red
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Red
  Write-Host ''
  Write-Host '   Rien n''a ete casse. Corrige ce qui est indique ci-dessus'
  Write-Host '   puis relance publier.cmd.'
  Write-Host ''
  try { [void](Read-Host '   Appuie sur Entree pour fermer') } catch { Start-Sleep -Seconds 15 }
  exit 1
}

# Plan B : quand l'envoi automatique n'est pas possible, on ouvre la page
# de depot de fichiers de GitHub : un seul fichier a glisser.
function Montrer-PlanB {
  param([string]$Raison)
  Write-Host ''
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Yellow
  Write-Host "    Envoi automatique impossible : $Raison" -ForegroundColor Yellow
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Yellow
  Write-Host ''
  Write-Host '    Plan B, trois clics, ca marche a coup sur :' -ForegroundColor White
  Write-Host ''
  Write-Host '      1. la page de depot GitHub va s''ouvrir dans ton navigateur' -ForegroundColor White
  Write-Host '      2. glisse dedans CE fichier :' -ForegroundColor White
  Write-Host "         $Artefact" -ForegroundColor Cyan
  Write-Host '      3. clique sur  Commit changes' -ForegroundColor White
  Write-Host ''
  try { Start-Process "https://github.com/$Depot/upload/$Branche" } catch { }
  try { [void](Read-Host '   Appuie sur Entree pour fermer') } catch { Start-Sleep -Seconds 30 }
  exit 1
}

# =====================================================================
# Debut
# =====================================================================
Clear-Host -ErrorAction SilentlyContinue
Ecrire-Titre 'XozHub.GPT - publier la ligne d''installation'

Ecrire-Note "Projet : $Projet"
Ecrire-Note "Depot  : $Depot  (branche $Branche)"

# ------------------------------------------------- 0. les outils
$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
  Montrer-PlanB "git n'est pas installe sur cet ordinateur"
}

# ------------------------------------- 1. refabriquer l'artefact
Ecrire-Vide
Ecrire-Etape '1' 'Refabrication de install-en-ligne.ps1'
$node = Get-Command node -ErrorAction SilentlyContinue
$generateur = Join-Path $Projet 'fabriquer-en-ligne.mjs'
if ($node -and (Test-Path $generateur)) {
  $sortie = & node $generateur 2>&1
  $code = $LASTEXITCODE
  $sortie | ForEach-Object { Ecrire-Note ([string]$_) }
  if ($code -ne 0) { Stop-Lisible 'La refabrication a echoue : lis les lignes ci-dessus.' }
  Ecrire-Ok 'Artefact refabrique - OK'
} else {
  Ecrire-Alerte 'node ou fabriquer-en-ligne.mjs introuvable : on publie le fichier tel quel.'
}

if (-not (Test-Path $Artefact)) {
  Stop-Lisible 'install-en-ligne.ps1 est absent de ce dossier.'
}
$Taille    = (Get-Item $Artefact).Length
$TailleKo  = [Math]::Round($Taille / 1KB)
Ecrire-Note "Fichier : $TailleKo Ko"

# Securite : ce qui se publie doit etre l'artefact complet (code + cle
# dedans), pas l'ancien script qui se contente de telecharger le projet.
if ($Taille -lt 200KB) {
  Stop-Lisible ("install-en-ligne.ps1 ne pese que $TailleKo Ko : ce n'est pas l'artefact complet." + `
    " Refais-le avec  node fabriquer-en-ligne.mjs  puis relance publier.cmd.")
}
Ecrire-Ok 'Artefact complet (code et cle embarques) - OK'

# ------------------------------------------- 2. recolter le depot
Ecrire-Vide
Ecrire-Etape '2' 'Recuperation de la version du depot'
if (Test-Path $Tour) {
  try { Remove-Item -LiteralPath $Tour -Recurse -Force } catch { }
}
# Sortie laissee a l'ecran : c'est elle qui porte le message utile.
& git clone --quiet --depth 1 --branch $Branche $DepotUrl $Tour
if ($LASTEXITCODE -ne 0) {
  Montrer-PlanB "le depot n'a pas pu etre recupere"
}
Ecrire-Ok 'Version du depot recuperee - OK'

# ---------------------------------------- 3. copier le projet
Ecrire-Vide
Ecrire-Etape '3' 'Copie du projet dans la version du depot'

# Ce qui reste chez toi : fichiers de la machine, artefacts fabriques.
$exclusFichiers = @(
  '.xozhub-session.json',   # ta session : aucun interet dans le depot
  '.xozhub-linked',
  'XozHub.md',              # memoire du projet, propre a ta machine
  'XozHub-GPT-Setup.exe',   # fabriques : ils contiennent ta cle, jamais dans le depot
  'XozHub-GPT-Installer.cmd',
  'XozHub-GPT.zip'
)
$exclusDossiers = @('.tmp-qa', 'node_modules', '.git')

$copies = 0
$elements = Get-ChildItem -LiteralPath $Projet -Force
foreach ($e in $elements) {
  if ($exclusFichiers -contains $e.Name) { continue }
  if ($e.PSIsContainer -and ($exclusDossiers -contains $e.Name)) { continue }
  try {
    Copy-Item -LiteralPath $e.FullName -Destination $Tour -Recurse -Force
    $copies++
  } catch {
    Ecrire-Alerte ("Ignore : " + $e.Name + " (" + $_.Exception.Message + ")")
  }
}
# Ces deux-la sont deja dans le depot alors que le .gitignore du projet les
# exclut : on les enleve, sinon ils reviennent a chaque publication.
foreach ($vieux in @('.xozhub-session.json', '.xozhub-linked')) {
  $p = Join-Path $Tour $vieux
  if (Test-Path $p) { try { Remove-Item -LiteralPath $p -Force } catch { } }
}
Ecrire-Ok "$copies element(s) copie(s) - OK"

# ------------------------------ 4. enregistrer la version
Ecrire-Vide
Ecrire-Etape '4' 'Enregistrement de la version'
& git -C $Tour -c core.autocrlf=false add -A
if ($LASTEXITCODE -ne 0) { Stop-Lisible 'L''ajout des fichiers a echoue.' }
$etat = & git -C $Tour status --porcelain
$aPousser = $true
if (-not $etat) {
  Ecrire-Note 'Le depot est deja identique au projet : rien de nouveau.'
  $aPousser = $false
} else {
  $lignes = ($etat | Measure-Object).Count
  Ecrire-Note "$lignes fichier(s) a mettre a jour."
  $message = "Publication de XozHub.GPT (install-en-ligne.ps1 : $Taille octets)"
  & git -C $Tour -c user.name='Qays67' -c user.email='Qays67@users.noreply.github.com' commit --quiet -m $message
  if ($LASTEXITCODE -ne 0) { Stop-Lisible 'L''enregistrement de la version a echoue.' }
  Ecrire-Ok 'Version enregistree - OK'
}

# Mode essai : tout est fait SAUF l'envoi. Sert a verifier que la
# recuperation, la copie et l'enregistrement se passent bien.
#   set XOZHUB_ESSAI=1  puis  publier.cmd
if ($env:XOZHUB_ESSAI) {
  Write-Host ''
  Ecrire-Alerte 'Mode essai : rien n''a ete envoye sur GitHub.'
  try { Remove-Item -LiteralPath $Tour -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  exit 0
}

# ------------------------------------------------ 5. envoyer
Ecrire-Vide
Ecrire-Etape '5' 'Envoi vers GitHub'
if ($aPousser) {
  Ecrire-Note 'Si une fenetre GitHub s''ouvre : connecte-toi, c''est la seule fois.'
  # Sortie laissee a l'ecran : c'est elle qui porte le message de GitHub,
  # et surtout ca n'interrompt pas la fenetre de connexion.
  & git -C $Tour push --quiet origin $Branche
  if ($LASTEXITCODE -ne 0) {
    Montrer-PlanB "GitHub a refuse l'envoi (connexion, droits, ou reseau)"
  }
  Ecrire-Ok 'Fichier envoye - OK'
} else {
  Ecrire-Note 'Rien a envoyer : le depot sert deja cette version.'
}

# ---------------------------------------------- 6. verifier
Ecrire-Vide
Ecrire-Etape '6' 'Verification : ce que le depot sert vraiment'
# Controle par l'EMPREINTE DU CONTENU, ecrite dans l'en-tete du fichier.
#
# Pourquoi pas la taille, ni l'empreinte du fichier : le code est chiffre avec
# une cle tiree au hasard a chaque fabrication. Deux versions differentes ont
# donc EXACTEMENT la meme taille, et le cache de GitHub peut servir la version
# precedente sans qu'on le voie. L'empreinte du contenu, elle, ne change que
# si le code change : si elle correspond, c'est bien cette version-la.
$motif = 'Contenu embarque\s*:\s*([0-9a-f]{16})'
$empreinteLocal = ''
$trouve = [regex]::Match([IO.File]::ReadAllText($Artefact), $motif)
if ($trouve.Success) { $empreinteLocal = $trouve.Groups[1].Value }

$octets = $null
$empreinteServie = ''
for ($i = 1; $i -le 12; $i++) {
  try {
    $wc = New-Object Net.WebClient
    $octets = $wc.DownloadData("$Adresse`?controle=$([Guid]::NewGuid().ToString('N'))")
    $vu = [regex]::Match([Text.Encoding]::UTF8.GetString($octets), $motif)
    $empreinteServie = if ($vu.Success) { $vu.Groups[1].Value } else { '' }
    if ($empreinteLocal -and $empreinteServie -eq $empreinteLocal) { break }
  } catch {
    $octets = $null
    $empreinteServie = ''
  }
  Start-Sleep -Seconds 5
}

Write-Host ''
if (-not $empreinteLocal) {
  Ecrire-Alerte 'Pas d''empreinte de contenu dans le fichier : relance la refabrication.'
} elseif ($empreinteServie -eq $empreinteLocal) {
  Ecrire-Ok "Le depot sert bien CETTE version (contenu $empreinteLocal) - OK"
} elseif ($octets -and $octets.Length -lt 200KB) {
  Ecrire-Alerte 'Le depot sert encore l''ANCIENNE version : la ligne echouera chez tout le monde.'
  Montrer-PlanB 'le fichier publie n''est pas celui attendu'
} elseif ($octets) {
  $vu = if ($empreinteServie) { $empreinteServie } else { 'inconnu' }
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Yellow
  Write-Host "    Le depot sert une AUTRE version (contenu $vu," -ForegroundColor Yellow
  Write-Host "    attendu $empreinteLocal)." -ForegroundColor Yellow
  Write-Host '    C''est le cache de GitHub : il se vide en 2 a 3 minutes.' -ForegroundColor Yellow
  Write-Host '    Relance publier.cmd dans un moment : il reessaiera.' -ForegroundColor Yellow
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Yellow
  Write-Host ''
} else {
  Ecrire-Alerte 'Impossible de relire le fichier depuis le depot (connexion ?).'
  Ecrire-Note "Va voir a la main : $Adresse"
}

# --------------------------------------------------- nettoyage
try { Remove-Item -LiteralPath $Tour -Recurse -Force -ErrorAction SilentlyContinue } catch { }

# ---------------------------------------------------- la ligne
Write-Host ''
Write-Host '   ============================================================' -ForegroundColor DarkCyan
Write-Host '    LA LIGNE A ENVOYER, telle quelle' -ForegroundColor Cyan
Write-Host '   ============================================================' -ForegroundColor DarkCyan
Write-Host ''
Write-Host "   $Ligne" -ForegroundColor Green
Write-Host ''
Write-Host '    La personne la colle dans une fenetre cmd, appuie Entree :' -ForegroundColor White
Write-Host '    l''IA s''installe (cle comprise) et s''ouvre toute seule.' -ForegroundColor White
Write-Host ''
Write-Host '    A savoir : le fichier publie contient ta cle X.GPT (base64).' -ForegroundColor DarkGray
Write-Host '    Qui l''a telecharge peut la lire : c''est ton compte qui paie.' -ForegroundColor DarkGray
Write-Host ''
Write-Host '    Le site (facultatif) : Settings -> Pages -> Source : main / docs' -ForegroundColor DarkGray
Write-Host "    -> https://qays67.github.io/XozHubCmdIA/" -ForegroundColor DarkGray
Write-Host ''
try { [void](Read-Host '   Appuie sur Entree pour fermer') } catch { Start-Sleep -Seconds 15 }
