// XozHub.GPT — lecture directe des fichiers par l'agent (blocs « read »).
//
// Sans ça, l'agent n'a qu'un moyen de lire un fichier : le shell. En cmd.exe, « type » casse
// les accents, ajoute des en-têtes, se perd dans les gros fichiers — et chaque lecture coûte
// un tour complet, commande affichée comprise. Ici, l'application lit le fichier elle-même et
// le lui rend exact : mêmes octets, mêmes accents, borné proprement, et sans rien exécuter.
//
//   ```read src/app.js
//   ```read src/app.js 200-320
//   ```read C:\projets\mon-site\style.css 1-80
//
// Le fichier reste sur le disque : c'est l'agent qui le lit, pas une copie qui traîne.

import fs from 'node:fs';
import path from 'node:path';

// ```read chemin   (tolérant : lire, lecture, open, cat, show…)
const OPEN = /^(`{3,})(?:read|lire|lecture|lis|open|cat|show|voir)[\s:]+(.+?)\s*$/i;

// « …/fichier.js 120-240 » ou « …/fichier.js:120-240 » : la plage de lignes est facultative.
const RANGE = /^(.*?)[\s:]+(\d+)\s*-\s*(\d+)$/;

// Bornes d'une lecture : au-delà, on renvoie un extrait et on explique comment avoir la suite.
const MAX_LINES = 500;
const MAX_BYTES = 60_000;

/** Reconnaît la fermeture : une ligne de purs accents graves, au moins aussi longue. */
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
 * Repère les blocs « read » d'une réponse, dans l'ordre.
 * Un bloc « read » n'a pas de contenu à écrire : tout ce qui suit l'ouverture jusqu'à la
 * fermeture est ignoré (l'agent met parfois un commentaire, on ne s'en sert pas).
 * Renvoie [{ path, from, to }] — `from`/`to` valent null quand aucune plage n'est demandée.
 */
export function parseReads(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) ticks = 0;
      continue;
    }
    const open = OPEN.exec(line);
    if (!open) continue;
    ticks = open[1].length;
    let rest = String(open[2]).trim();
    let from = null;
    let to = null;
    const range = RANGE.exec(rest);
    if (range && cleanPath(range[1])) {
      from = Number(range[2]);
      to = Number(range[3]);
      rest = range[1];
    }
    const file = cleanPath(rest);
    if (!file) continue;
    const entry = { path: file, from, to };
    out.push(entry);
  }
  return out;
}

/** Le texte sans les blocs « read » : ce qui reste à afficher. */
export function stripReads(text) {
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
 * Le texte avec les blocs « read » remplacés par une marque : le contenu lu part au modèle
 * juste après, il n'a pas besoin de rester en plus dans l'historique.
 */
export function foldReads(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        ticks = 0;
        out.push('… (lecture demandée) …', line);
      }
      continue;
    }
    const open = OPEN.exec(line);
    if (open) ticks = open[1].length;
    out.push(line);
  }
  return out.join('\n');
}

/** Un fichier binaire ne se lit pas : on le dit au lieu de déverser des octets illisibles. */
function looksBinary(buffer) {
  const head = buffer.subarray(0, 4000);
  return head.includes(0);
}

/**
 * Lit les fichiers demandés.
 * Renvoie [{ path, ok, content, totalLines, from, to, error }] :
 *   - `content` est le texte exact du fichier (ou l'extrait demandé), prêt à être rendu ;
 *   - `error` explique ce qui bloque (fichier absent, dossier, binaire) pour que l'agent
 *     corrige son chemin au lieu de recommencer à l'aveugle.
 */
export function readFiles(rootDir, requests) {
  return (requests || []).map((req) => {
    const name = String(req.path || '').trim();
    const target = path.isAbsolute(name) ? name : path.join(rootDir, name);
    const base = { path: name, ok: false, content: '', totalLines: 0, from: null, to: null, error: '' };

    let stat;
    try {
      stat = fs.statSync(target);
    } catch {
      return { ...base, error: 'fichier introuvable' };
    }
    if (stat.isDirectory()) {
      return { ...base, error: 'c’est un dossier, pas un fichier' };
    }
    if (!stat.isFile() || stat.size > 4_000_000) {
      return { ...base, error: `fichier trop gros ou illisible (${stat.size} octets)` };
    }

    let buffer;
    try {
      buffer = fs.readFileSync(target);
    } catch (err) {
      return { ...base, error: `lecture impossible : ${err.message}` };
    }
    if (looksBinary(buffer)) {
      return { ...base, error: 'fichier binaire — rien à en faire en texte' };
    }

    const lines = buffer.toString('utf8').split('\n');
    const total = lines.length;
    // Plage demandée : on la borne au fichier réel, et on accepte qu'elle soit à l'envers.
    const askedFrom = req.from === null || req.from === undefined ? 1 : Math.max(1, req.from);
    const askedTo = req.to === null || req.to === undefined ? total : Math.max(askedFrom, req.to);
    const from = Math.min(askedFrom, total);
    const to = Math.min(askedTo, from + MAX_LINES - 1, total);
    let slice = lines.slice(from - 1, to).join('\n');
    if (slice.length > MAX_BYTES) slice = slice.slice(0, MAX_BYTES);

    const truncated = to < total;
    const footer = truncated
      ? `\n… (lignes ${from} à ${to} sur ${total} — demande la suite avec « \`\`\`read ${name} ${to + 1}-${Math.min(total, to + MAX_LINES)} ») …`
      : '';

    return {
      path: name,
      ok: true,
      content: slice + footer,
      totalLines: total,
      from,
      to,
      error: '',
    };
  });
}

/** Ce qu'on écrit dans le journal : la lecture est un fait, pas une commande. */
export function describeRead(r) {
  return r.ok
    ? `${r.path} · ${r.from}-${r.to} sur ${r.totalLines} ligne${r.totalLines > 1 ? 's' : ''} lues`
    : `Lecture impossible : ${r.path} — ${r.error}`;
}

/** Le paquet renvoyé au modèle : ses fichiers, exactement comme ils sont sur le disque. */
export function readsMessage(rootDir, results) {
  const parts = [];
  for (const r of results) {
    if (!r.ok) {
      parts.push(`[Lecture impossible : ${r.path} — ${r.error}]`);
      continue;
    }
    parts.push(
      `[Contenu de ${r.path} — lignes ${r.from} à ${r.to} sur ${r.totalLines}, lu depuis ${rootDir}]`,
      r.content,
      `[Fin de ${r.path}]`,
    );
  }
  return parts.join('\n');
}
