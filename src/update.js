// XozHub.GPT — mise à jour du code et redémarrage à chaud.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { PACKAGE_ROOT } from './config.js';

const ENTRY = path.join(PACKAGE_ROOT, 'bin', 'xozhub.js');

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
