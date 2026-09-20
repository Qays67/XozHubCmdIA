# =====================================================================
#  XozHub.GPT - bandeau : logo ASCII en gros blocs + ligne d'etat.
# =====================================================================
#
#  Utilisation :
#
#    powershell -NoProfile -ExecutionPolicy Bypass -File banniere.ps1 -Statut "En cours de lancement..."
#
#  Le logo est peint avec les VRAIES couleurs de XozHub : le degrade
#  indigo -> violet -> magenta -> cyan du logo de l'interface, en 24 bits.
#  Chaque plein du dessin est une espace remplie par sa couleur de fond :
#  le rendu ne depend donc d'aucune police particuliere.
#
#  Le fichier ne contient QUE de l'ASCII (le bloc plein est construit par le
#  code) : il se lit pareil sur toutes les machines, quelle que soit la page
#  de codes de Windows.
#
#  Il est appele par : install.cmd, install-en-ligne.ps1 et xozhub.cmd.
#  Une seule source pour le dessin et les couleurs : les trois fenetres
#  affichent donc exactement le meme logo.
# =====================================================================

# -Attente : nombre de secondes ou le logo reste seul a l'ecran. Sert au lancement
# (le temps de le lire) ; l'installeur et la mise a jour n'attendent pas, leurs
# messages prennent la suite tout de suite.
param([string]$Statut = '', [double]$Attente = 0)

# Couleur de chaque trait du dessin, du plus sombre au plus clair : c'est le
# degrade du logo de l'interface, dans le meme ordre.
$Stops = @(
  @(99, 102, 241), # indigo
  @(139, 92, 246), # violet
  @(232, 121, 249), # magenta
  @(34, 211, 238) # cyan
)

# Le mot, en '#' : converti en blocs pleins a l'affichage (voir $Bloc).
$Art = @(
  '###  ###   ######   ########  ###  ###  ###  ###  ####### ',
  '###  ###  ###  ###  ########  ###  ###  ###  ###  ###  ###',
  ' ######   ##    ##      ####  ###  ###  ###  ###  ###  ###',
  '  ####    ##    ##     ####   ########  ###  ###  ####### ',
  '  ####    ##    ##    ####    ########  ###  ###  ###  ###',
  ' ######   ##    ##   ####     ###  ###  ###  ###  ###  ###',
  '###  ###  ###  ###  ########  ###  ###  ########  ###  ###',
  '###  ###   ######   ########  ###  ###   ######   ####### '
)

$Bloc = [char]0x2588

# Code ANSI complet : la sequence est fermee par le 'm' final, sinon le terminal
# avale le caractere suivant au lieu de le colorer.
# Note : jamais "$e[...]" dans une chaine, PowerShell s'y croirait en train
# d'indexer la variable.
function Echap { param([string]$Codes) "$([char]27)[$($Codes)m" }

# Teinte du i-eme caractere : le degrade traverse le mot de gauche a droite.
function Get-Teinte {
  param([int]$Position, [int]$Largeur)
  $dernier = $Stops.Length - 1
  $index = [Math]::Round(($Position / [Math]::Max(1, $Largeur)) * $dernier)
  return $Stops[[Math]::Min($dernier, [Math]::Max(0, $index))]
}

function Ecrire-Logo {
  for ($r = 0; $r -lt $Art.Length; $r++) {
    $chars = $Art[$r].ToCharArray()
    $ligne = ''
    for ($i = 0; $i -lt $chars.Length; $i++) {
      if ($chars[$i] -eq ' ') { $ligne += ' '; continue }
      $s = Get-Teinte $i ($chars.Length - 1)
      $fond = "$($s[0]);$($s[1]);$($s[2])"
      $ligne += (Echap "48;2;$fond") + (Echap "38;2;$fond") + $Bloc + (Echap '0')
    }
    # Le badge de la marque vient se poser sur l'avant-derniere ligne, comme dans l'interface.
    if ($r -eq 6) { $ligne += '  ' + (Echap '38;2;34;211;238') + (Echap '1') + '.GPT' + (Echap '0') }
    Write-Host $ligne
  }
}

function Ecrire-Statut {
  param([string]$Texte)
  if (-not $Texte) { return }
  $filet = (Echap '38;2;97;89;214') + ('=' * 62) + (Echap '0')
  Write-Host ''
  Write-Host "   $filet"
  Write-Host ('     ' + (Echap '38;2;34;211;238') + (Echap '1') + $Texte + (Echap '0'))
  Write-Host "   $filet"
  Write-Host ''
}

Write-Host ''
Ecrire-Logo
Ecrire-Statut $Statut
if ($Attente -gt 0) { Start-Sleep -Seconds $Attente }
