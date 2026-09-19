# XozHub.GPT - fabrique UN SEUL fichier a donner aux potes.
#
# Usage : double-clic sur fabriquer.cmd
#         (ou : powershell -NoProfile -ExecutionPolicy Bypass -File fabriquer.ps1)
#
# Resultat : XozHub-GPT-Installer.cmd  ->  UN SEUL fichier.
# La personne qui le recoit double-clique dessus : l'IA s'installe et une
# nouvelle fenetre s'ouvre. Aucun dossier a transmettre, rien d'autre a faire.
#
# Aucune dependance : uniquement PowerShell (present sur Windows).

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
$out = Join-Path $root 'XozHub-GPT-Installer.cmd'

Write-Host ''
Write-Host '  =========================================================='
Write-Host '   XozHub.GPT - fabrication du fichier a donner aux potes'
Write-Host '  =========================================================='
Write-Host ''

# --- 1) copie propre dans un dossier temporaire -------------------------------
$stage = Join-Path $env:TEMP 'xozhub-stage'
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

foreach ($dir in @('bin', 'src')) {
  $p = Join-Path $root $dir
  if (Test-Path $p) { Copy-Item $p -Destination $stage -Recurse -Force }
  else { Write-Host "  ATTENTION : dossier manquant : $dir" }
}
foreach ($f in @('package.json', 'xozhub.cmd', 'install.cmd', 'xoz.cmd', '.env', 'README.md')) {
  $p = Join-Path $root $f
  if (Test-Path $p) { Copy-Item $p -Destination $stage -Force }
  elseif ($f -eq '.env') { Write-Host '  ATTENTION : pas de .env -> la cle API manquera.' }
}

# --- 2) compression -----------------------------------------------------------
$zip = Join-Path $env:TEMP 'xozhub-payload.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force

# --- 3) encodage du paquet ----------------------------------------------------
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($zip))

# --- 4) construction du .cmd auto-extractible ---------------------------------
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
AddL 'where node >nul 2>nul || echo   XozHub.GPT a besoin de Node.js 18 ou plus.'
AddL 'where node >nul 2>nul || echo   Installe-le depuis https://nodejs.org puis relance ce fichier.'
AddL 'where node >nul 2>nul || pause'
AddL 'where node >nul 2>nul || exit /b 1'
AddL 'echo   Installation en cours, patiente quelques secondes...'
AddL 'echo.'
AddL 'powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-Content -Raw ''%~f0''; $k='':__XOZHUB_PAYLOAD__''; $i=$c.LastIndexOf($k); $b=$c.Substring($i+$k.Length).Trim(); $z=Join-Path $env:TEMP ''xozhub-installer.zip''; [IO.File]::WriteAllBytes($z,[Convert]::FromBase64String($b)); $d=Join-Path $env:TEMP ''xozhub-installer''; if(Test-Path $d){Remove-Item $d -Recurse -Force}; Expand-Archive -Force $z $d; & (Join-Path $d ''install.cmd'')"'
AddL 'if errorlevel 1 echo   ERREUR : l''installation a echoue.'
AddL 'if errorlevel 1 pause'
AddL 'exit /b 0'
AddL ':__XOZHUB_PAYLOAD__'

$size = 120
for ($i = 0; $i -lt $b64.Length; $i += $size) {
  $len = [Math]::Min($size, $b64.Length - $i)
  AddL $b64.Substring($i, $len)
}

$content = ($lines -join $nl) + $nl
[IO.File]::WriteAllText($out, $content, [Text.Encoding]::ASCII)

# --- 5) nettoyage et resume ---------------------------------------------------
Remove-Item $stage -Recurse -Force
if (Test-Path $zip) { Remove-Item $zip -Force }

$ko = [Math]::Round((Get-Item $out).Length / 1KB, 0)
Write-Host "  FICHIER CREE : XozHub-GPT-Installer.cmd  ($ko Ko)"
Write-Host ''
Write-Host '  Tu donnes CE fichier a tes potes : UN seul fichier, aucun dossier.'
Write-Host '  Ils double-cliquent dessus -> l''IA s''installe et s''ouvre.'
Write-Host ''
