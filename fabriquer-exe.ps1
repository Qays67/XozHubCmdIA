# XozHub.GPT - fabrique l'installateur .exe.
#
# Usage : double-clic sur fabriquer-exe.cmd
#         (ou : powershell -NoProfile -ExecutionPolicy Bypass -File fabriquer-exe.ps1)
#
# Resultat : XozHub-GPT-Setup.exe  ->  UN SEUL fichier .exe.
# La personne double-clique dessus : l'IA s'installe dans %LOCALAPPDATA%\XozHub,
# la commande xozhub est ajoutee au PATH, et une fenetre s'ouvre avec l'interface.
# Rien n'est telecharge pendant l'installation : tout est dans le .exe.
#
# COMMENT CA MARCHE
#   1. le code (bin, src, package.json, xozhub.cmd, install.cmd, fabriquer-protege.mjs,
#      .env) est compresse puis encode en base64 ;
#   2. ce paquet est colle a la fin d'un petit lanceur .cmd (celui-ci s'extrait
#      tout seul, puis appelle install.cmd) ;
#   3. ce lanceur est emballe dans un .exe auto-extractible par IExpress, un
#      outil present sur tous les Windows. Aucun logiciel a installer.
#
# ATTENTION - LA CLE API
#   Le .exe contient le .env, donc la cle API, s'il y a un .env a cote de ce
#   script. Dans ce cas il est fait pour etre DONNE a la main (potes, cle USB),
#   pas pour etre mis en telechargement public : n'importe qui peut ouvrir le
#   .exe et lire la cle. Pour un .exe public, renomme ou supprime .env avant de
#   lancer ce script : l'installateur demandera alors la cle a la personne.

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
# Le fichier fabrique va dans dist\ : c'est la que vivent les choses a donner.
$out = Join-Path $root 'dist\XozHub-GPT-Setup.exe'
$dossierSortie = Split-Path -Parent $out
if (-not (Test-Path $dossierSortie)) { New-Item -ItemType Directory -Path $dossierSortie -Force | Out-Null }

Write-Host ''
Write-Host '  =========================================================='
Write-Host '   XozHub.GPT - fabrication de l''installateur .exe'
Write-Host '  =========================================================='
Write-Host ''

$iexpress = Join-Path $env:SystemRoot 'System32\iexpress.exe'
if (-not (Test-Path $iexpress)) { $iexpress = Join-Path $env:SystemRoot 'SysWOW64\iexpress.exe' }
if (-not (Test-Path $iexpress)) {
  Write-Host '  ERREUR : IExpress est introuvable sur cet ordinateur.'
  Write-Host '  Utilise fabriquer.cmd : le fichier .cmd marche aussi.'
  exit 1
}

# --- 1) copie propre dans un dossier temporaire -------------------------------
$stage = Join-Path $env:TEMP 'xozhub-exe'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

$avecCle = $false

foreach ($dir in @('bin', 'src')) {
  $p = Join-Path $root $dir
  if (Test-Path $p) { Copy-Item $p -Destination $stage -Recurse -Force }
  else { Write-Host "  ATTENTION : dossier manquant : $dir" }
}

foreach ($f in @('package.json', 'xozhub.cmd', 'banniere.ps1', 'xoz.cmd', 'install.cmd', 'fabriquer-protege.mjs', '.env')) {
  $p = Join-Path $root $f
  if (Test-Path $p) {
    Copy-Item $p -Destination $stage -Force
    if ($f -eq '.env') { $avecCle = $true }
  }
  elseif ($f -eq 'install.cmd') { Write-Host '  ATTENTION : install.cmd manquant, l''installation ne pourra pas se faire.' }
  elseif ($f -eq 'fabriquer-protege.mjs') { Write-Host '  ATTENTION : fabriquer-protege.mjs manquant, le code installe restera LISIBLE.' }
}

if ($avecCle) {
  Write-Host '  ATTENTION : un .env est present -> la cle API sera DANS le .exe.'
  Write-Host '              Ne mets ce .exe en telechargement public que si tu acceptes'
  Write-Host '              que n''importe qui puisse lire cette cle.'
} else {
  Write-Host '  Aucun .env trouve : l''installateur DEMANDERA la cle a la personne.'
}

# --- 2) compression du code ---------------------------------------------------
$zip = Join-Path $env:TEMP 'xozhub-exe-payload.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force

# --- 3) encodage du paquet ----------------------------------------------------
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($zip))

# --- 4) le lanceur (.cmd) qui va etre emballe dans le .exe --------------------
# Fins de ligne CRLF : cmd.exe se trompe de position avec des LF.
$nl = [string][char]13 + [string][char]10
$lines = New-Object System.Collections.Generic.List[string]
function AddL([string]$t) { [void]$lines.Add($t) }

AddL '@echo off'
AddL 'setlocal EnableExtensions'
AddL 'title XozHub.GPT - Installation'
AddL 'echo.'
AddL 'echo    =========================================================='
AddL 'echo     X O Z H U B . G P T   -   installation automatique'
AddL 'echo    =========================================================='
AddL 'echo.'
AddL 'echo    Patiente, l''installation se fait toute seule.'
AddL 'echo.'
AddL 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-Content -Raw ''%~f0''; $k='':__XOZHUB_PAYLOAD__''; $i=$c.LastIndexOf($k); $b=$c.Substring($i+$k.Length).Trim(); $z=Join-Path $env:TEMP ''xozhub-setup.zip''; [IO.File]::WriteAllBytes($z,[Convert]::FromBase64String($b)); $d=Join-Path $env:TEMP ''xozhub-setup''; if(Test-Path $d){Remove-Item $d -Recurse -Force}; Expand-Archive -Force $z $d; & (Join-Path $d ''install.cmd'')"'
AddL 'if errorlevel 1 echo.'
AddL 'if errorlevel 1 echo    ERREUR : l''installation a echoue.'
AddL 'if errorlevel 1 echo    Reprends une photo de cette fenetre et envoie-la.'
AddL 'if errorlevel 1 pause'
AddL 'exit /b 0'
AddL ':__XOZHUB_PAYLOAD__'

$size = 120
for ($i = 0; $i -lt $b64.Length; $i += $size) {
  $len = [Math]::Min($size, $b64.Length - $i)
  AddL $b64.Substring($i, $len)
}

# Le lanceur va dans un dossier a lui : c'est ce dossier que IExpress emballe.
$sfx = Join-Path $env:TEMP 'xozhub-sfx'
if (Test-Path $sfx) { Remove-Item $sfx -Recurse -Force }
New-Item -ItemType Directory -Path $sfx | Out-Null
$launcher = Join-Path $sfx 'xozhub-setup.cmd'
[IO.File]::WriteAllText($launcher, (($lines -join $nl) + $nl), [Text.Encoding]::ASCII)

# --- 5) script IExpress -------------------------------------------------------
$sed = @()
$sed += '[Version]'
$sed += 'Class=IEXPRESS'
$sed += 'SEDVersion=3'
$sed += '[Options]'
$sed += 'PackagePurpose=InstallApp'
$sed += 'ShowInstallProgramWindow=1'
$sed += 'HideExtractAnimation=0'
$sed += 'UseLongFileName=1'
$sed += 'InsideCompressed=0'
$sed += 'CAB_FixedSize=0'
$sed += 'CAB_ResvCodeSigning=0'
$sed += 'RebootMode=N'
$sed += 'InstallPrompt='
$sed += 'DisplayLicense='
$sed += 'FinishMessage='
$sed += 'TargetName=' + $out
$sed += 'FriendlyName=XozHub.GPT'
$sed += 'AppLaunched=xozhub-setup.cmd'
$sed += 'PostInstallCmd=<None>'
$sed += 'AdminQuietInstCmd='
$sed += 'UserQuietInstCmd='
$sed += 'SourceFiles=SourceFiles'
$sed += '[Strings]'
$sed += 'FILE0="xozhub-setup.cmd"'
$sed += '[SourceFiles]'
$sed += 'SourceFiles0=' + $sfx + '\'
$sed += '[SourceFiles0]'
$sed += '%FILE0%='

$sedFile = Join-Path $sfx 'xozhub-build.sed'
[IO.File]::WriteAllText($sedFile, (($sed -join $nl) + $nl), [Text.Encoding]::ASCII)

# --- 6) fabrication du .exe ---------------------------------------------------
if (Test-Path $out) { Remove-Item $out -Force }

Write-Host ''
Write-Host '  Fabrication du .exe (IExpress)...'
& $iexpress '/N' '/Q' $sedFile | Out-Null

if (Test-Path $out) { Remove-Item $launcher -Force }
if (Test-Path $sedFile) { Remove-Item $sedFile -Force }

# --- 7) nettoyage et resume ---------------------------------------------------
Remove-Item $stage -Recurse -Force
Remove-Item $sfx -Recurse -Force
if (Test-Path $zip) { Remove-Item $zip -Force }

if (-not (Test-Path $out)) {
  Write-Host ''
  Write-Host '  ERREUR : le .exe n''a pas pu etre cree.'
  Write-Host '  Cause la plus frequente : un chemin avec des espaces ou des accents'
  Write-Host '  (par exemple un nom d''utilisateur avec un espace). Dans ce cas :'
  Write-Host '  copie le projet dans C:\XozHub et relance ce script.'
  Write-Host '  Autre solution qui marche toujours : fabriquer.cmd (fichier .cmd).'
  exit 1
}

$ko = [Math]::Round((Get-Item $out).Length / 1KB, 0)
Write-Host ''
Write-Host '  =========================================================='
Write-Host "   FICHIER CREE : XozHub-GPT-Setup.exe  ($ko Ko)"
Write-Host '  =========================================================='
Write-Host ''
Write-Host '  Tu donnes CE fichier : la personne double-clique dessus,'
Write-Host '  l''IA s''installe et s''ouvre. Rien d''autre a faire.'
Write-Host ''
Write-Host '  Pour le mettre en telechargement sur le site : joins-le a une'
Write-Host '  Release GitHub (le lien du site pointe dessus).'
Write-Host ''
