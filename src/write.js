// XozHub.GPT — écriture directe des fichiers demandés par l'agent (blocs « write »).
//
// En cmd.exe, créer un fichier proprement oblige à bricoler des « echo … > fichier » ou des
// scripts qui génèrent les fichiers : accents cassés, guillemets perdus, sauts de ligne
// impossibles. Ici, l'agent écrit le contenu complet dans un bloc, et l'application l'écrit
// elle-même sur le disque — exactement ce qu'il a écrit.

import fs from 'node:fs';
import path from 'node:path';

// ```write chemin/du/fichier.ext   (tolérant : file, fichier, écrit, create…)
// Le nombre d'accents graves peut monter (````write) quand le fichier contient lui-même des ``` :
// seul un délimiteur au moins aussi long referme le bloc, comme en Markdown.
const OPEN =
  /^(`{3,})(?:write|file|fichier|ecrit|écrit|ecrire|écrire|create|créer|cree|nouveau|new)[\s:]+(.+?)\s*$/i;

/** Reconnaît la fermeture : une ligne de purs accents graves, au moins aussi longue que l'ouverture. */
function isClose(line, count) {
  const ticks = String(line).trim();
  return ticks.length >= count && /^`+$/.test(ticks);
}

/** Nettoie un chemin écrit par l'agent : guillemets, espaces, « .\ ». */
function cleanPath(raw) {
  return String(raw || '')
    .trim()
    .replace(/^["'`]|["'`]$/g, '')
    .replace(/^\.\s*[\\/]\s*/, '')
    .trim();
}

/**
 * Repère tous les blocs « write » d'une réponse, dans l'ordre.
 * Renvoie [{ path, content }]. Un bloc non refermé est ignoré : mieux vaut ne rien
 * écrire que d'écrire un fichier coupé en deux.
 */
export function parseWrites(text) {
  const out = [];
  let current = null;
  for (const line of String(text ?? '').split('\n')) {
    if (current) {
      if (isClose(line, current.ticks)) {
        out.push({ path: current.path, content: current.lines.join('\n') });
        current = null;
        continue;
      }
      current.lines.push(line);
      continue;
    }
    const open = OPEN.exec(line);
    if (!open) continue;
    const file = cleanPath(open[2]);
    if (file) current = { path: file, lines: [], ticks: open[1].length };
  }
  return out;
}

/** Le texte sans les blocs « write » : ce qui reste à afficher. */
export function stripWrites(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) ticks = 0;
      continue;
    }
    const open = OPEN.exec(line);
    if (open) {
      ticks = open[1].length;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Le texte avec le contenu des blocs « write » remplacé par une marque : le fichier est sur le
 * disque, l'agent peut le relire, et l'historique ne gonfle pas avec des milliers de lignes.
 */
export function foldWrites(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        ticks = 0;
        out.push('… (contenu du fichier écrit sur le disque) …', line);
      }
      continue;
    }
    const open = OPEN.exec(line);
    if (open) ticks = open[1].length;
    out.push(line);
  }
  return out.join('\n');
}

// ------------------------------------------------------------------ blocs « edit »
//
// Réécrire un fichier existant en entier pour changer trois lignes est le plus sûr moyen de
// perdre du code au passage : une ligne oubliée, une indentation qui glisse, et le fichier
// est cassé. Un bloc « edit » remplace uniquement ce qui change, comme un cherche/remplacer :
//
//   ```edit src/app.js
//   <<<<<<< ANCIEN
//   const port = 3000;
//   =======
//   const port = 8080;
//   >>>>>>> NOUVEAU
//   ```
//
// Plusieurs paires dans le même bloc sont acceptées, et plusieurs blocs aussi.

const OPEN_EDIT =
  /^(`{3,})(?:edit|edite|édite|modifie|modifier|change|changer|remplace|remplacer|patch|corrige|update|maj)[\s:]+(.+?)\s*$/i;
const FIND_MARK = /^<{5,}/;
const MID_MARK = /^={5,}/;
const REPLACE_MARK = /^>{5,}/;

/**
 * Repère les blocs « edit » et leurs paires cherche/remplace.
 * Renvoie [{ path, pairs: [{ find, replace }] }] — une paire incomplète est ignorée :
 * mieux vaut ne rien modifier que modifier à moitié.
 */
export function parseEdits(text) {
  const out = [];
  let block = null;
  let ticks = 0;
  let mode = 'none';
  let find = [];
  let replace = [];

  const flushPair = () => {
    if (block && mode === 'replace') {
      block.pairs.push({ find: find.join('\n'), replace: replace.join('\n') });
    }
    find = [];
    replace = [];
    mode = 'none';
  };

  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        flushPair();
        if (block && block.pairs.length) out.push(block);
        block = null;
        ticks = 0;
        continue;
      }
      if (FIND_MARK.test(line)) {
        flushPair();
        mode = 'find';
        continue;
      }
      if (MID_MARK.test(line) && mode === 'find') {
        mode = 'replace';
        continue;
      }
      if (REPLACE_MARK.test(line) && mode === 'replace') {
        flushPair();
        continue;
      }
      if (mode === 'find') find.push(line);
      else if (mode === 'replace') replace.push(line);
      continue;
    }
    const open = OPEN_EDIT.exec(line);
    if (!open) continue;
    const file = cleanPath(open[2]);
    if (!file) continue;
    ticks = open[1].length;
    block = { path: file, pairs: [] };
  }
  return out;
}

/** Le texte sans les blocs « edit » : ce qui reste à afficher. */
export function stripEdits(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) ticks = 0;
      continue;
    }
    const open = OPEN_EDIT.exec(line);
    if (open) {
      ticks = open[1].length;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/** Le texte avec les blocs « edit » remplacés par une marque : les modifications sont faites. */
export function foldEdits(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        ticks = 0;
        out.push('… (modification envoyée) …', line);
      }
      continue;
    }
    const open = OPEN_EDIT.exec(line);
    if (open) ticks = open[1].length;
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Repli quand le texte exact n'est pas trouvé : on compare les lignes sans leurs espaces de
 * bord. Un modèle se trompe rarement de contenu, il se trompe d'indentation — et sans ce
 * repli, chaque erreur d'espace coûte un tour entier.
 * Renvoie null si le motif n'est pas unique (0 ou plusieurs correspondances).
 */
function fuzzyReplace(content, findText, replaceText) {
  const fileLines = content.split('\n');
  const needle = findText.split('\n').map((l) => l.trim());
  const width = needle.length;
  let hit = -1;
  let count = 0;
  for (let i = 0; i + width <= fileLines.length; i += 1) {
    let same = true;
    for (let j = 0; j < width; j += 1) {
      if (fileLines[i + j].trim() !== needle[j]) {
        same = false;
        break;
      }
    }
    if (same) {
      count += 1;
      hit = i;
    }
  }
  if (count !== 1 || hit === -1) return null;
  return fileLines
    .slice(0, hit)
    .concat(replaceText.split('\n'), fileLines.slice(hit + width))
    .join('\n');
}

/** Applique une paire cherche/remplace. Renvoie { ok, content, reason, fuzzy }. */
function applyPair(content, pair) {
  const findText = String(pair.find ?? '');
  if (!findText.trim()) {
    return { ok: false, reason: 'bloc vide : rien à chercher', fuzzy: false };
  }
  const hits = content.split(findText).length - 1;
  if (hits === 1) {
    return { ok: true, content: content.replace(findText, pair.replace ?? ''), fuzzy: false };
  }
  if (hits > 1) {
    return {
      ok: false,
      reason: `motif trouvé ${hits} fois — recopie plus de contexte autour, ou cible une seule occurrence`,
      fuzzy: false,
    };
  }
  const relaxed = fuzzyReplace(content, findText, String(pair.replace ?? ''));
  if (relaxed !== null) return { ok: true, content: relaxed, fuzzy: true };
  return {
    ok: false,
    reason: 'motif introuvable — relis le fichier (bloc « read ») et recopie le passage exactement',
    fuzzy: false,
  };
}

/**
 * Applique les modifications sur le disque.
 * Renvoie [{ path, ok, applied, failed: [raison], fuzzy, error }] : chaque paire est
 * appliquée indépendamment, et le fichier n'est écrit que s'il a vraiment changé.
 */
export function applyEdits(rootDir, edits) {
  return (edits || []).map((edit) => {
    const target = path.isAbsolute(edit.path) ? edit.path : path.join(rootDir, edit.path);
    let content;
    try {
      content = fs.readFileSync(target, 'utf8');
    } catch (err) {
      return { path: edit.path, ok: false, applied: 0, failed: [], fuzzy: false, error: `fichier illisible : ${err.message}` };
    }
    let work = content;
    let applied = 0;
    let fuzzy = false;
    const failed = [];
    for (const pair of edit.pairs) {
      const res = applyPair(work, pair);
      if (res.ok) {
        work = res.content;
        applied += 1;
        fuzzy = fuzzy || res.fuzzy;
      } else {
        failed.push(res.reason);
      }
    }
    if (!applied) {
      return { path: edit.path, ok: false, applied: 0, failed, fuzzy: false, error: failed[0] || 'rien à appliquer' };
    }
    try {
      if (work !== content) fs.writeFileSync(target, work, 'utf8');
    } catch (err) {
      return { path: edit.path, ok: false, applied: 0, failed, fuzzy: false, error: `écriture impossible : ${err.message}` };
    }
    return { path: edit.path, ok: true, applied, failed, fuzzy, error: '' };
  });
}

/**
 * Écrit les fichiers sur le disque (les dossiers manquants sont créés).
 * Renvoie [{ path, ok, bytes, lines, error }].
 */
export function applyWrites(rootDir, writes) {
  return (writes || []).map((w) => {
    const target = path.isAbsolute(w.path) ? w.path : path.join(rootDir, w.path);
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const content = `${String(w.content ?? '').replace(/\s+$/, '')}\n`;
      fs.writeFileSync(target, content, 'utf8');
      return {
        path: w.path,
        ok: true,
        bytes: Buffer.byteLength(content, 'utf8'),
        lines: Math.max(1, content.split('\n').length - 1),
      };
    } catch (err) {
      return { path: w.path, ok: false, error: err.message };
    }
  });
}
