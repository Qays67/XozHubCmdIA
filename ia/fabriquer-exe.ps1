# XozHub.AI - fabrique l'installateur XozHub-AI-Setup.exe
#
# Usage : double-clic sur fabriquer-exe.cmd
#         (ou : powershell -NoProfile -ExecutionPolicy Bypass -File fabriquer-exe.ps1)
#
# Resultat : XozHub-AI-Setup.exe -> UN SEUL fichier.
# La personne double-clique dessus : l'IA s'installe dans %LOCALAPPDATA%\XozHubAI,
# un raccourci XOZHUB.AI est pose sur le Bureau, et SA fenetre s'ouvre. Ce n'est
# pas un programme en ligne de commande : aucune console ne reste a l'ecran.
#
# COMMENT CA MARCHE
#   1. le dossier ia\ (dont l'icone galaxie), le moteur src\, package.json et .env
#      sont compresses puis
#      encodes en base64 ;
#   2. ce paquet est colle a la fin d'un petit lanceur .cmd, qui s'extrait tout
#      seul puis appelle ia\installer.ps1 ;
#   3. ce lanceur est emballe dans un .exe auto-extractible par IExpress, present
#      sur tous les Windows : aucun outil a installer pour fabriquer le .exe.
#
# NOTE : aucun accent dans ce fichier (PowerShell 5.1 lit les .ps1 sans BOM en ANSI).

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
$projet = Split-Path -Parent $root
$out = Join-Path $projet 'dist\XozHub-AI-Setup.exe'

Write-Host ''
Write-Host '  ==========================================================' -ForegroundColor DarkMagenta
Write-Host '   XozHub.AI - fabrication de l''installateur .exe' -ForegroundColor Magenta
Write-Host '  ==========================================================' -ForegroundColor DarkMagenta
Write-Host ''

$iexpress = Join-Path $env:SystemRoot 'System32\iexpress.exe'
if (-not (Test-Path $iexpress)) { $iexpress = Join-Path $env:SystemRoot 'SysWOW64\iexpress.exe' }
if (-not (Test-Path $iexpress)) {
  Write-Host '  ERREUR : IExpress est introuvable sur cet ordinateur.' -ForegroundColor Red
  exit 1
}

# --- 1) copie propre dans un dossier temporaire -------------------------------
$stage = Join-Path $env:TEMP 'xozhub-ai-exe'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

$avecCle = $false

$moteur = Join-Path $projet 'src'
if (Test-Path $moteur) { Copy-Item $moteur -Destination $stage -Recurse -Force }
else { Write-Host '  ATTENTION : dossier src\ manquant : l''IA ne pourra pas travailler.' -ForegroundColor Yellow }

$app = Join-Path $stage 'ia'
New-Item -ItemType Directory -Path $app | Out-Null
foreach ($f in @('serveur.mjs', 'ui.html', 'lancer.vbs', 'installer.ps1', 'xozhub-ai.ico')) {
  $p = Join-Path $root $f
  if (Test-Path $p) { Copy-Item $p -Destination $app -Force }
  else { Write-Host "  ATTENTION : fichier manquant : ia\$f" -ForegroundColor Yellow }
}

foreach ($f in @('package.json', '.env')) {
  $p = Join-Path $projet $f
  if (Test-Path $p) {
    Copy-Item $p -Destination $stage -Force
    if ($f -eq '.env') { $avecCle = $true }
  }
}

if ($avecCle) {
  Write-Host '  Un .env est present : la cle API sera DANS le .exe,' -ForegroundColor Yellow
  Write-Host '  donc la personne n''aura rien a saisir.' -ForegroundColor Yellow
} else {
  Write-Host '  Aucun .env : l''installateur DEMANDERA la cle a la personne.' -ForegroundColor Yellow
}

# --- 2) compression du paquet -------------------------------------------------
$zip = Join-Path $env:TEMP 'xozhub-ai-payload.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force

# --- 3) encodage --------------------------------------------------------------
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($zip))

# --- 4) le lanceur (.cmd) qui sera emballe dans le .exe -----------------------
# Fins de ligne CRLF : cmd.exe se trompe de position avec des LF.
$nl = [string][char]13 + [string][char]10
$lines = New-Object System.Collections.Generic.List[string]
function AddL([string]$t) { [void]$lines.Add($t) }

AddL '@echo off'
AddL 'setlocal EnableExtensions'
AddL 'title XozHub.AI - Installation'
AddL 'echo.'
AddL 'echo    =========================================================='
AddL 'echo     X O Z H U B . A I   -   installation automatique'
AddL 'echo    =========================================================='
AddL 'echo.'
AddL 'echo    Patiente, l''installation se fait toute seule.'
AddL 'echo.'
AddL 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-Content -Raw ''%~f0''; $k='':__XOZHUB_IA_PAYLOAD__''; $i=$c.LastIndexOf($k); $b=$c.Substring($i+$k.Length).Trim(); $z=Join-Path $env:TEMP ''xozhub-ai.zip''; [IO.File]::WriteAllBytes($z,[Convert]::FromBase64String($b)); $d=Join-Path $env:TEMP ''xozhub-ai''; if(Test-Path $d){Remove-Item $d -Recurse -Force}; Expand-Archive -Force $z $d; & (Join-Path $d ''ia\installer.ps1'')"'
AddL 'if errorlevel 1 echo.'
AddL 'if errorlevel 1 echo    ERREUR : l''installation a echoue.'
AddL 'if errorlevel 1 echo    Reprends une photo de cette fenetre et envoie-la.'
AddL 'if errorlevel 1 pause'
AddL 'exit /b 0'
AddL ':__XOZHUB_IA_PAYLOAD__'

$size = 120
for ($i = 0; $i -lt $b64.Length; $i += $size) {
  $len = [Math]::Min($size, $b64.Length - $i)
  AddL $b64.Substring($i, $len)
}

$sfx = Join-Path $env:TEMP 'xozhub-ai-sfx'
if (Test-Path $sfx) { Remove-Item $sfx -Recurse -Force }
New-Item -ItemType Directory -Path $sfx | Out-Null
$launcher = Join-Path $sfx 'xozhub-ai-setup.cmd'
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
$sed += 'FriendlyName=XozHub.AI'
$sed += 'AppLaunched=xozhub-ai-setup.cmd'
$sed += 'PostInstallCmd=<None>'
$sed += 'AdminQuietInstCmd='
$sed += 'UserQuietInstCmd='
$sed += 'SourceFiles=SourceFiles'
$sed += '[Strings]'
$sed += 'FILE0="xozhub-ai-setup.cmd"'
$sed += '[SourceFiles]'
$sed += 'SourceFiles0=' + $sfx + '\'
$sed += '[SourceFiles0]'
$sed += '%FILE0%='

$sedFile = Join-Path $sfx 'xozhub-ai-build.sed'
[IO.File]::WriteAllText($sedFile, (($sed -join $nl) + $nl), [Text.Encoding]::ASCII)

# --- 6) fabrication ------------------------------------------------------------
$dossierSortie = Split-Path -Parent $out
if (-not (Test-Path $dossierSortie)) { New-Item -ItemType Directory -Path $dossierSortie -Force | Out-Null }
if (Test-Path $out) { Remove-Item $out -Force }

Write-Host ''
Write-Host '  Fabrication du .exe (IExpress)...' -ForegroundColor Cyan
& $iexpress '/N' '/Q' $sedFile | Out-Null

if (Test-Path $out) { Remove-Item $launcher -Force }
if (Test-Path $sedFile) { Remove-Item $sedFile -Force }
Remove-Item $stage -Recurse -Force
Remove-Item $sfx -Recurse -Force
if (Test-Path $zip) { Remove-Item $zip -Force }

if (-not (Test-Path $out)) {
  Write-Host ''
  Write-Host '  ERREUR : le .exe n''a pas pu etre cree.' -ForegroundColor Red
  Write-Host '  Cause la plus frequente : un chemin avec des espaces ou des accents.' -ForegroundColor Red
  Write-Host '  Copie le projet dans C:\XozHub et relance ce script.' -ForegroundColor Red
  exit 1
}

$ko = [Math]::Round((Get-Item $out).Length / 1KB, 0)
Write-Host ''
Write-Host '  ==========================================================' -ForegroundColor DarkMagenta
Write-Host "   FICHIER CREE : XozHub-AI-Setup.exe  ($ko Ko)" -ForegroundColor Magenta
Write-Host '  ==========================================================' -ForegroundColor DarkMagenta
Write-Host ''
Write-Host '  Tu donnes CE fichier : double-clic, l''IA s''installe,'
Write-Host '  le raccourci XOZHUB.AI arrive sur le Bureau, la fenetre s''ouvre.'
Write-Host ''
Write-Host '  Pour le lien de telechargement du site : joins-le a une Release'
Write-Host '  GitHub (voir dist\README.md).'
Write-Host ''
