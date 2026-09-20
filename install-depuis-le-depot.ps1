# =====================================================================
#  XozHub.GPT - installation en UNE SEULE LIGNE (Windows)
# =====================================================================
#
#  La personne ouvre une fenetre cmd, colle cette ligne, appuie Entree :
#
#    powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Qays67/XozHubCmdIA/main/install-en-ligne.ps1 | iex"
#
#  C'est tout. Ce script s'occupe du reste, dans cet ordre :
#
#    1. il telecharge le projet depuis GitHub ;
#    2. il verifie que le projet est COMPLET (bin/xozhub.js, src/) et,
#       si le depot a ete rempli « a plat » (les fichiers de bin/ et de src/
#       ranges a la racine, sans leurs dossiers - l'erreur la plus courante
#       quand on met le projet en ligne depuis l'interface de GitHub),
#       il RECONSTRUIT les dossiers bin/ et src/ avant de continuer ;
#    3. il remet les fichiers .cmd / .bat en CRLF - sans quoi cmd.exe se
#       trompe de position des qu'il croise un goto ou un bloc if ( ... )
#       et sort une cascade d'erreurs du genre
#       « 'rrorlevel' n'est pas reconnu en tant que commande » ;
#    4. il confie l'installation a install.cmd, celui du projet :
#       UNE SEULE logique d'installation, deux facons de la lancer ;
#    5. il efface ses fichiers temporaires.
#
#  A l'arrivee, il ne reste chez la personne AUCUN script lisible : le
#  dernier pas de install.cmd rassemble le code en un seul fichier chiffre
#  (fabriquer-protege.mjs) et efface les sources.
#
#  AUCUNE QUESTION N'EST POSEE : la cle X.GPT commune voyage dans le .env
#  du projet, donc la personne qui installe n'a rien a taper.
#
#  Ce fichier n'a pas besoin d'etre telecharge a la main : il est fait
#  pour etre lance par « irm ... | iex ». Il ne depend donc ni de
#  $PSScriptRoot, ni d'un dossier courant precis.
# =====================================================================

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# ------------------------------------------------------------ reglages
# Si tu renommes ton depot : change ces deux lignes, et rien d'autre.
$Depot   = 'Qays67/XozHubCmdIA'   # <-- proprietaire/nom du depot GitHub
$Branche = 'main'                 # <-- branche utilisee (public)

$ZipUrl = "https://github.com/$Depot/archive/refs/heads/$Branche.zip"

# ------------------------------------------------------------- couleurs
function Ecrire-Vide { Write-Host '' }
function Ecrire-Titre {
  param([string]$Texte)
  Write-Host ''
  Write-Host '   ============================================================' -ForegroundColor DarkCyan
  Write-Host "    $Texte" -ForegroundColor Cyan
  Write-Host '   ============================================================' -ForegroundColor DarkCyan
  Write-Host ''
}
function Ecrire-Etape { param([string]$Num, [string]$Texte) Write-Host "   [$Num] $Texte" -ForegroundColor White }
function Ecrire-Ok     { param([string]$Texte) Write-Host "        $Texte" -ForegroundColor Green }
function Ecrire-Note   { param([string]$Texte) Write-Host "        $Texte" -ForegroundColor DarkGray }
function Ecrire-Alerte { param([string]$Texte) Write-Host "        $Texte" -ForegroundColor Yellow }

# Garde la fenetre ouverte sur une erreur, pour que le message soit lisible.
function Stop-Lisible {
  param([string]$Message)
  Write-Host ''
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Red
  Write-Host "    $Message" -ForegroundColor Red
  Write-Host '   ------------------------------------------------------------' -ForegroundColor Red
  Write-Host ''
  Write-Host '    Rien n''a ete casse : relance simplement la ligne.'
  Write-Host '    Si ca recommence, envoie cette fenetre a la personne qui t''a donne XozHub.GPT.'
  Write-Host ''
  try { [void](Read-Host '    Appuie sur Entree pour fermer') } catch { Start-Sleep -Seconds 10 }
  exit 1
}

# ------------------------------------------------- repare les .cmd/.bat
# Remet les fins de ligne en CRLF et retire un eventuel BOM : cmd.exe ne
# sait lire ni l'un ni l'autre quand ils sont mal places.
function Reparer-FinsDeLigne {
  param([string]$Racine)
  $n = 0
  # Filtre EXPLICITE sur l'extension : avec -LiteralPath, le parametre -Include
  # de PowerShell ne filtre rien du tout et on reecrirait tout le projet.
  $fichiers = Get-ChildItem -LiteralPath $Racine -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -eq '.cmd' -or $_.Extension -eq '.bat' }
  $fichiers | ForEach-Object {
    try {
      $texte = [IO.File]::ReadAllText($_.FullName)
      $texte = $texte.TrimStart([char]0xFEFF)
      $texte = ($texte -replace "`r`n", "`n") -replace "`r", "`n"
      $texte = $texte -replace "`n", "`r`n"
      [IO.File]::WriteAllText($_.FullName, $texte, (New-Object System.Text.UTF8Encoding($false)))
      $n++
    } catch {
      # un fichier verrouille ne doit pas tout arreter
    }
  }
  return $n
}

# --------------------------------------- ou est le vrai projet dans l'archive
# Le .zip de GitHub contient un dossier  XozHubCmdIA-main\ . Si en plus on a
# glisse le dossier du projet dans le depot, on a  XozHubCmdIA-main\Xozhub\ .
# On cherche donc bin\xozhub.js sur trois niveaux, au lieu de supposer qu'il est
# juste la : c'est l'erreur la plus courante quand on met le projet en ligne.
function Chercher-Racine {
  param([string]$Depuis, [int]$Profondeur = 0)
  if (Test-Path (Join-Path $Depuis 'bin\xozhub.js')) { return $Depuis }
  if ($Profondeur -ge 3) { return $null }
  foreach ($d in (Get-ChildItem -LiteralPath $Depuis -Directory -ErrorAction SilentlyContinue)) {
    $trouve = Chercher-Racine -Depuis $d.FullName -Profondeur ($Profondeur + 1)
    if ($trouve) { return $trouve }
  }
  return $null
}

# ------------------------ depot « a plat » : on reconstruit les dossiers
# Remplir un depot depuis l'interface de GitHub en glissant les FICHIERS de
# bin\ et de src\ (au lieu des dossiers) range tout a la racine : le projet
# est complet, mais sans ses dossiers, donc impossible a copier.
# On les refabrique : bin\xozhub.js, et src\ pour tous les autres .js.
function Reparer-Dossiers {
  param([string]$Racine)

  if (Test-Path (Join-Path $Racine 'bin\xozhub.js')) { return $null }

  $pistes = @($Racine) + @(Get-ChildItem -LiteralPath $Racine -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { $_.FullName })

  foreach ($d in $pistes) {
    if (-not (Test-Path (Join-Path $d 'xozhub.js'))) { continue }
    # Un dossier « a plat » : le point d'entree ET les modules de src cote a cote.
    $modules = @(Get-ChildItem -LiteralPath $d -File -Filter '*.js' -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -ne 'xozhub.js' })
    if ($modules.Count -lt 5) { continue }

    $bin = Join-Path $d 'bin'
    $src = Join-Path $d 'src'
    New-Item -ItemType Directory -Force -Path $bin | Out-Null
    New-Item -ItemType Directory -Force -Path $src | Out-Null
    Move-Item -LiteralPath (Join-Path $d 'xozhub.js') -Destination (Join-Path $bin 'xozhub.js') -Force
    foreach ($m in $modules) {
      Move-Item -LiteralPath $m.FullName -Destination (Join-Path $src $m.Name) -Force
    }
    return $d
  }

  return $null
}

# =====================================================================
#  Debut
# =====================================================================
# Le bandeau colore (logo + « En cours d'installation... ») est peint par
# install.cmd, juste apres le telechargement : le dessin et les couleurs vivent
# dans banniere.ps1, une seule fois pour toute la chaine d'installation.
Clear-Host -ErrorAction SilentlyContinue
Ecrire-Vide
Write-Host '   X O Z H U B . G P T' -ForegroundColor Magenta
Write-Host '   agent de developpement en ligne de commande' -ForegroundColor DarkCyan
Ecrire-Vide
Write-Host '    Installation automatique - tu n''as rien a taper.' -ForegroundColor White
Write-Host '    Laisse cette fenetre ouverte, ca prend une minute.' -ForegroundColor DarkGray

# --------------------------------------------------------- 1. le projet
Ecrire-Titre '1/4  Recuperation de XozHub.GPT'
Ecrire-Etape '1' 'Telechargement du projet...'
Ecrire-Note "Depuis $ZipUrl"

$Dossier = Join-Path $env:TEMP ("xozhub-install-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
$Zip     = Join-Path $Dossier 'projet.zip'
$Extrait = Join-Path $Dossier 'projet'

try {
  New-Item -ItemType Directory -Path $Dossier -Force | Out-Null
} catch {
  Stop-Lisible "Impossible d'ecrire dans le dossier temporaire ($env:TEMP)."
}

$telecharge = $false
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Invoke-WebRequest -Uri $ZipUrl -OutFile $Zip
  $telecharge = (Test-Path $Zip) -and ((Get-Item $Zip).Length -gt 1024)
} catch {
  $telecharge = $false
}

# Second essai avec curl.exe : il passe la ou Invoke-WebRequest bute.
if (-not $telecharge) {
  $curl = Get-Command 'curl.exe' -ErrorAction SilentlyContinue
  if ($curl) {
    try {
      & $curl.Source -L --fail --silent --show-error -o $Zip $ZipUrl
      $telecharge = (Test-Path $Zip) -and ((Get-Item $Zip).Length -gt 1024)
    } catch {
      $telecharge = $false
    }
  }
}

if (-not $telecharge) {
  try { Remove-Item -LiteralPath $Dossier -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  Stop-Lisible "Le telechargement du projet a echoue. Verifie ta connexion internet, puis relance la ligne."
}
Ecrire-Ok 'Projet telecharge - OK'

# ------------------------------------------------- 2. dezippage + controle
Ecrire-Vide
Ecrire-Etape '2' 'Preparation des fichiers...'
try {
  New-Item -ItemType Directory -Path $Extrait -Force | Out-Null
  Expand-Archive -LiteralPath $Zip -DestinationPath $Extrait -Force
} catch {
  try { Remove-Item -LiteralPath $Dossier -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  Stop-Lisible "Le fichier telecharge n'a pas pu etre dezippe."
}

$Src = Chercher-Racine -Depuis $Extrait

# Depot rempli « a plat » : on refabrique bin\ et src\ au lieu d'abandonner.
if (-not $Src) {
  $Src = Reparer-Dossiers -Racine $Extrait
  if ($Src) {
    Ecrire-Alerte 'Depot servi sans ses dossiers : bin\ et src\ reconstitues - OK'
  }
}

if (-not $Src) {
  try { Remove-Item -LiteralPath $Dossier -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  Stop-Lisible ("Le projet telecharge est INCOMPLET : impossible de trouver bin\xozhub.js dedans." +
    " Verifie que les dossiers bin\ et src\ ont bien ete mis dans le depot (avec leur nom de dossier).")
}

# Controle : les dossiers et fichiers indispensables sont-ils la ?
$manquants = @()
foreach ($f in @('bin\xozhub.js', 'src\app.js', 'src\ui.js', 'src\api.js', 'install.cmd', 'fabriquer-protege.mjs')) {
  if (-not (Test-Path (Join-Path $Src $f))) { $manquants += $f }
}
if ($manquants.Count -gt 0) {
  try { Remove-Item -LiteralPath $Dossier -Recurse -Force -ErrorAction SilentlyContinue } catch { }
  Stop-Lisible ("Le projet telecharge est incomplet. Fichiers absents : " + ($manquants -join ', '))
}
Ecrire-Ok 'Projet complet (bin\ et src\) - OK'

# ------------------------------------------------- 3. fins de ligne CRLF
Ecrire-Vide
Ecrire-Etape '3' 'Preparation des fichiers de commandes...'
$corriges = Reparer-FinsDeLigne -Racine $Src
Ecrire-Ok "Fins de ligne verifiees ($corriges fichier(s) .cmd) - OK"

# La cle commune : si le .env a voyagé avec le projet, personne ne tape rien.
if (Test-Path (Join-Path $Src '.env')) {
  Ecrire-Ok 'Cle X.GPT commune trouvee - personne n''a rien a saisir'
} else {
  Ecrire-Alerte 'Pas de .env dans le projet : la cle X.GPT te sera demandee.'
}

# ------------------------------------------------------ 4. installation
Ecrire-Vide
Ecrire-Etape '4' 'Installation...'
Ecrire-Note 'C''est install.cmd du projet qui fait le travail.'
Ecrire-Vide

$installateur = Join-Path $Src 'install.cmd'
& cmd.exe /d /c "`"$installateur`""

# ------------------------------------------------------------ nettoyage
try { Remove-Item -LiteralPath $Dossier -Recurse -Force -ErrorAction SilentlyContinue } catch { }

Ecrire-Vide
Write-Host '    Fichiers temporaires effaces.' -ForegroundColor DarkGray
Write-Host ''
