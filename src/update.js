// XozHub.GPT — mise à jour du code et redémarrage à chaud.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PACKAGE_ROOT } from './config.js';

const ENTRY = path.join(PACKAGE_ROOT, 'bin', 'xozhub.js');
const BANNIERE = path.join(PACKAGE_ROOT, 'banniere.ps1');

function run(args, { dir = PACKAGE_ROOT, timeout = 10000 } = {}) {
  try {
    return spawnSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
    });
  } catch (err) {
    return { error: err };
  }
}

/** Le dossier d'installation est-il un dépôt git (donc mettable à jour par un pull) ? */
export function isGitRepo(dir = PACKAGE_ROOT) {
  const res = run(['rev-parse', '--is-inside-work-tree'], { dir });
  return !res.error && res.status === 0 && String(res.stdout || '').trim() === 'true';
}

/** Version courte du commit courant, pour l'afficher. */
export function currentRevision(dir = PACKAGE_ROOT) {
  const res = run(['rev-parse', '--short', 'HEAD'], { dir });
  return !res.error && res.status === 0 ? String(res.stdout || '').trim() : '';
}

/**
 * Récupère la dernière version du code (`git pull --ff-only`).
 * Renvoie { ok, changed, message }.
 */
export function pullLatest(dir = PACKAGE_ROOT) {
  const before = currentRevision(dir);
  const res = run(['pull', '--ff-only'], { dir, timeout: 180000 });

  if (res.error) {
    return { ok: false, changed: false, message: `git indisponible (${res.error.code || res.error.message})` };
  }
  const out = `${res.stdout || ''}${res.stderr || ''}`.trim();
  if (res.status !== 0) {
    return { ok: false, changed: false, message: out || `git pull a échoué (code ${res.status})` };
  }
  const after = currentRevision(dir);
  return {
    ok: true,
    changed: Boolean(before && after && before !== after),
    message: out || 'déjà à jour',
    before,
    after,
  };
}

/** Le petit script cmd qui fait tourner LA fenêtre de mise à jour. */
const SCRIPT_MAJ = path.join(os.tmpdir(), 'xozhub-mise-a-jour.cmd');

/**
 * Ouvre la mise à jour dans une NOUVELLE fenêtre cmd, en trois temps :
 *
 *   1. le bandeau XozHub : logo coloré + « En cours de mise à jour… » ;
 *   2. la mise à jour elle-même (git pull, code protégé) et son compte rendu ;
 *   3. l'interface, dans la même fenêtre, avec le code à jour.
 *
 * Trois détails qui font toute la différence :
 *
 *   - on passe par « start » : c'est le seul moyen fiable d'obtenir une VRAIE
 *     fenêtre de console depuis Node sur Windows (un spawn détaché n'attache
 *     aucune console, et le bandeau ne s'afficherait nulle part) ;
 *   - c'est un petit .cmd qui mène la fenêtre, pas un powershell. Un powershell
 *     qui se termine referme sa console et tue avec elle la version qu'il vient
 *     de lancer ; un cmd reste propriétaire de la console jusqu'à la fin de
 *     l'interface, donc la fenêtre ne se referme pas sous ses pieds ;
 *   - l'interface est lancée par ce même .cmd, en ligne suivante : une instance
 *     neuve, qui charge donc bien le code qui vient d'être récupéré.
 *
 * Le fichier est écrit en CRLF : sans ça, cmd.exe se trompe de position dès
 * qu'il croise le bloc if ( ... ) du bandeau.
 *
 * Renvoie false si la fenêtre n'a pas pu être ouverte.
 */
export function openUpdateWindow({ restartOnly = false, env = process.env } = {}) {
  const statut = restartOnly ? 'Redemarrage en cours...' : 'En cours de mise a jour...';
  const titre = restartOnly ? 'XozHub.GPT - Redemarrage' : 'XozHub.GPT - Mise a jour';
  const lignes = [
    '@echo off',
    'setlocal EnableExtensions',
    `title ${titre}`,
    '',
    'rem --- 1. le bandeau XozHub, avec le statut de l operation ---',
    `if exist "${BANNIERE}" (`,
    `  powershell -NoProfile -ExecutionPolicy Bypass -File "${BANNIERE}" -Statut "${statut}"`,
    ') else (',
    `  echo   ${titre}...`,
    ')',
    '',
    'rem --- 2. le code : version recuperee, ou simplement verifiee ---',
    `node "${ENTRY}" --mise-a-jour${restartOnly ? ' --relance-seule' : ''}`,
    '',
    'rem --- 3. l interface, dans CETTE fenetre : conversation reprise ---',
    'set "XOZHUB_RESUME=1"',
    restartOnly ? 'set "XOZHUB_UPDATE_DONE="' : 'set "XOZHUB_UPDATE_DONE=1"',
    `node "${ENTRY}"`,
    '',
  ];
  try {
    fs.writeFileSync(SCRIPT_MAJ, lignes.join('\r\n'), 'utf8');
  } catch {
    return false;
  }

  try {
    const enfant = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'start', '', SCRIPT_MAJ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env,
    });
    enfant.on('error', () => {});
    enfant.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Le travail de la mise à jour, exécuté dans la fenêtre dédiée. Le bandeau a
 * déjà été affiché : ici on récupère le code, on dit ce qui s'est passé, et on
 * rend la main. L'interface est lancée juste après par le .cmd, en processus
 * neuf — c'est ce qui garantit qu'elle tourne bien sur le code récupéré.
 */
export async function runUpdateHandoff({ restartOnly = false } = {}) {
  const dire = (texte) => process.stdout.write(`${texte}\n`);
  if (restartOnly) {
    dire('  Redemarrage sur le code present dans le dossier...');
  } else if (!isGitRepo()) {
    dire('  Pas de depot git ici : relance sur le code present dans le dossier');
    dire('  (remplace les fichiers a la main pour changer de version).');
  } else {
    dire('  Recherche de la derniere version...');
    const res = pullLatest();
    dire(
      res.ok
        ? res.changed
          ? `  Code mis a jour (${res.before} -> ${res.after}).`
          : '  Deja a jour : rien a recuperer.'
        : `  Mise a jour impossible : ${res.message}`,
    );
  }
  dire('  Lancement de XozHub.GPT...');
  return true;
}

/**
 * Relance XozHub.GPT dans le même terminal, avec le code à jour.
 * À appeler une fois le terminal remis dans son état normal (écran, mode brut, souris).
 */
export function relaunch(cwd, { resume = true, model = '', updateDone = false } = {}) {
  try {
    const child = spawn(process.execPath, [ENTRY], {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        // Les marqueurs de relance sont remis à zéro : un drapeau hérité du processus
        // parent ne doit pas survivre à un redémarrage lancé à la main.
        XOZHUB_RESUME: resume ? '1' : '',
        // La nouvelle instance affiche le bandeau « mise à jour validée » quelques secondes.
        XOZHUB_UPDATE_DONE: updateDone ? '1' : '',
        // Le modèle choisi reste celui de la session : sans ça, un XOZHUB_MODEL
        // resté dans .env reprendrait la main au redémarrage.
        ...(model ? { XOZHUB_MODEL: model } : {}),
      },
    });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}
