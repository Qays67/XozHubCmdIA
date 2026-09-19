// XozHub.GPT — exécution de commandes shell.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { PACKAGE_ROOT } from './config.js';

/**
 * Vrai si la commande demande au système d'ouvrir une page ou une fenêtre
 * (navigateur, explorateur de fichiers). L'agent n'ouvre rien de lui-même :
 * `runCommand` refuse alors la commande, sauf si la personne l'a demandé
 * (`allowWindow`). Seules les cibles qui font vraiment ouvrir quelque chose le
 * sont visées (une URL,
 * un fichier .html/.htm), pour ne pas bloquer « npm run start » ou « open » sur
 * un fichier de code.
 */
export function opensExternalWindow(command) {
  const c = String(command || '');
  const target = `["']?(?:https?://|www[.]|file://|[^\\s"']*\\.html?\\b)`;
  const openers = [
    // Windows : start ["titre"] <cible>
    `(^|[\\s&|;(])start(?:\\.exe)?\\s+(?:"[^"]*"\\s+)?${target}`,
    // Windows : explorer, rundll32 url.dll — macOS : open — Linux : xdg-open
    `(^|[\\s&|;(])(?:explorer(?:\\.exe)?|rundll32(?:\\.exe)?\\s+url\\.dll[^\\s]*|open|xdg-open)\\s+${target}`,
    // PowerShell : Start-Process <cible>
    `(^|[\\s&|;(])start-process\\s+${target}`,
  ];
  return openers.some((re) => new RegExp(re, 'i').test(c));
}

/**
 * Lance une commande shell et capture sa sortie complète (sans troncature).
 * `onSpawn(child)` permet à l'appelant de garder la main pour l'interrompre.
 * `timeoutMs: 0` (défaut) = aucune limite de durée ; Échap reste disponible.
 */
export function runCommand(command, { cwd, timeoutMs = 0, onSpawn, allowWindow = false } = {}) {
  return new Promise((resolve) => {
    // L'agent n'ouvre pas de fenêtre de lui-même, mais il le fait quand la
    // personne le demande (`allowWindow`). Sinon, on lui renvoie de quoi se
    // corriger seul, sans rien lancer.
    if (!allowWindow && opensExternalWindow(command)) {
      resolve({
        code: 1,
        stdout: '',
        stderr:
          "[ouverture de fenêtre désactivée] Cette commande aurait ouvert une page : elle n'a pas " +
          "été lancée. Vérifie autrement (serveur local + curl, lecture du fichier, test) et donne " +
          "à la personne le chemin ou l'adresse à ouvrir elle-même. Si elle a explicitement demandé " +
          'cette ouverture, dis-le : elle sera alors autorisée.',
        timedOut: false,
        blocked: true,
      });
      return;
    }

    const isWindows = process.platform === 'win32';
    // Force l'UTF-8 dans la console Windows pour éviter le texte illisible.
    const full = isWindows && !/chcp/i.test(command) ? `chcp 65001>nul & ${command}` : command;

    let child;
    try {
      child = spawn(full, { shell: true, cwd, windowsHide: true, env: process.env });
    } catch (err) {
      resolve({ code: -1, stdout: '', stderr: String(err.message), timedOut: false });
      return;
    }

    if (onSpawn) onSpawn(child);

    let stdout = '';
    let stderr = '';
    let done = false;
    let timedOut = false;

    const append = (target, chunk) => target + chunk;

    child.stdout?.on('data', (d) => {
      stdout = append(stdout, d.toString());
    });
    child.stderr?.on('data', (d) => {
      stderr = append(stderr, d.toString());
    });

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            timedOut = true;
            try {
              child.kill();
            } catch {
              /* ignore */
            }
          }, timeoutMs)
        : null;

    const finish = (result) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      resolve(result);
    };

    child.on('error', (err) => finish({ code: -1, stdout, stderr: stderr + String(err.message), timedOut }));
    child.on('close', (code) => finish({ code, stdout, stderr, timedOut }));
  });
}

/**
 * Ouvre une nouvelle fenêtre de terminal avec un XozHub.GPT tout neuf dedans
 * (nouvelle session, dans le dossier `cwd`). Renvoie true si la commande est partie.
 */
/** Copie un texte dans le presse-papiers du système (clip.exe, pbcopy, xclip). */
export function copyToClipboard(text) {
  const cmd = process.platform === 'win32' ? 'clip.exe' : process.platform === 'darwin' ? 'pbcopy' : 'xclip';
  const args = process.platform === 'linux' ? ['-selection', 'clipboard'] : [];
  try {
    const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });
    child.on('error', () => {});
    child.stdin.on('error', () => {});
    child.stdin.end(String(text ?? ''));
    return true;
  } catch {
    return false;
  }
}

export function launchNewSession(cwd) {
  const node = process.execPath;
  const entry = path.join(PACKAGE_ROOT, 'bin', 'xozhub.js');
  const q = (s) => `"${String(s).replace(/"/g, '')}"`;
  const run = `${q(node)} ${q(entry)}`;

  let command;
  if (process.platform === 'win32') {
    // `start` ouvre une vraie fenêtre cmd qui reste ouverte (cmd /k).
    command = `start "" cmd /k ${run}`;
  } else if (process.platform === 'darwin') {
    const dir = String(cwd || process.cwd()).replace(/"/g, '');
    command =
      `osascript -e 'tell application "Terminal" to do script "cd ${dir} && ${run}"' ` +
      `-e 'tell application "Terminal" to activate'`;
  } else {
    command = `x-terminal-emulator -e ${run}`;
  }

  try {
    const child = spawn(command, {
      shell: true,
      cwd,
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/** Met en forme le résultat d'une commande pour l'affichage et le modèle. */
export function formatResult(res) {
  const parts = [];
  const out = (res.stdout || '').replace(/\s+$/, '');
  const err = (res.stderr || '').replace(/\s+$/, '');
  if (out) parts.push(out);
  if (err) parts.push(err);
  if (res.timedOut) parts.push('[délai dépassé — processus interrompu]');
  parts.push(`[code de sortie ${res.code}]`);
  return parts.join('\n');
}
