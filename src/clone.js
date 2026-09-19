// XozHub.GPT — la copie locale complète d'un site : le même, vraiment.
//
// Refabriquer un site « dans le même esprit » à partir d'une analyse, c'est une reconstruction.
// Quand on demande LE MÊME site, il n'y a qu'une façon d'y arriver : prendre la page, ses
// feuilles de style, ses scripts, ses images et ses polices, les ranger dans un dossier du
// projet, et réécrire tous les liens pour que ça s'ouvre hors ligne, à l'identique.
//
//   ```clone https://exemple.fr
//   ```clone https://exemple.fr mon-site
//
// L'application télécharge, vérifie chaque fichier (taille, type), réécrit les références
// (HTML et CSS, y compris les url() et les srcset), et dit exactement ce qui a été pris, ce qui
// a échoué et ce qui a été laissé en lien absolu pour que la page reste utilisable.
//
// Les fichiers récupérés restent la propriété de leurs auteurs : un CLONE.md est écrit dans le
// dossier pour le rappeler, avec l'adresse d'origine.

import fs from 'node:fs';
import path from 'node:path';

// ```clone adresse [dossier]
const OPEN = /^(`{3,})(?:clone|copie|copier|miroir|mirror|download|telecharge|télécharge|aspire|wget)[\s:]+(.+?)\s*$/i;

const TIMEOUT_MS = 20_000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const MAX_FILES = 80;
const MAX_FILE_BYTES = 6_000_000;
const MAX_TOTAL_BYTES = 40_000_000;
const MAX_CSS_DEPTH = 2;

function isClose(line, count) {
  const ticks = String(line).trim();
  return ticks.length >= count && /^`+$/.test(ticks);
}

/** « https://exemple.fr/a/b » → « a/b », nettoyé et sans remontée de dossier. */
function safePath(urlText) {
  let p = '';
  try {
    const u = new URL(urlText);
    p = decodeURIComponent(u.pathname);
  } catch {
    return 'index';
  }
  const segments = p
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/[^\w.\-]+/g, '_').slice(0, 60))
    .filter((s) => s !== '..' && s !== '.');
  return segments.join('/') || 'index';
}

/** Le nom de dossier par défaut : « https://exemple.fr » → « exemple ». */
export function folderFor(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host.split('.').slice(0, 1).join('').replace(/[^a-z0-9-]/gi, '') || 'site';
  } catch {
    return 'site';
  }
}

/** Repère les blocs « clone ». Renvoie [{ url, folder }]. */
export function parseClones(text) {
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
    const rest = String(open[2]).trim().replace(/^["'`]|["'`]$/g, '');
    // Premier mot : l'adresse. Les suivants : le dossier de destination (« -> mon-site »).
    const mots = rest.split(/\s+/).filter(Boolean);
    const premier = (mots[0] || '').replace(/^[<>]+/, '').replace(/[,;]+$/, '');
    let url = '';
    try {
      url = new URL(/^https?:\/\//i.test(premier) ? premier : `https://${premier}`).toString();
    } catch {
      continue;
    }
    const dossier = mots
      .slice(1)
      .map((m) => m.replace(/^->|^=>/, '').replace(/[\\/]+$/, ''))
      .find((m) => m && /^[\w][\w./-]*$/.test(m));
    if (url) out.push({ url, folder: dossier || folderFor(url) });
  }
  return out;
}

/** Le texte sans les blocs « clone ». */
export function stripClones(text) {
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

/** Le texte avec les blocs « clone » remplacés par une marque. */
export function foldClones(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        ticks = 0;
        out.push('… (copie demandée) …', line);
      }
      continue;
    }
    const open = OPEN.exec(line);
    if (open) ticks = open[1].length;
    out.push(line);
  }
  return out.join('\n');
}

// --------------------------------------------------------------------- outils

/** Adresse absolue d'une référence, ou null si on n'y touche pas (ancre, data:, mailto:…). */
function absolutize(ref, base) {
  const raw = String(ref || '').trim();
  if (!raw || raw.startsWith('#') || /^(?:data:|mailto:|tel:|javascript:|blob:)/i.test(raw)) return null;
  try {
    const url = new URL(raw, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

/** Chemin relatif depuis `fromDir` vers `toPath` (toujours en « / »). */
function relativeRef(fromDir, toPath) {
  const rel = path.posix.relative(fromDir.split(path.sep).join('/') || '.', toPath.split(path.sep).join('/'));
  return rel || path.posix.basename(toPath);
}

async function get(url, { signal, timeout = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: '*/*' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_FILE_BYTES) throw new Error(`fichier trop lourd (${Math.round(buffer.length / 1024)} Ko)`);
    return { buffer, type: res.headers.get('content-type') || '', finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

// --------------------------------------------------------------------- analyse des références

const SRCSET = /srcset\s*=\s*["']([^"']+)["']/gi;
const CSSURL = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const CSSIMPORT = /@import\s+(?:url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])/gi;

/** Toutes les références d'une page, avec leur nature. */
function refsInHtml(html, base) {
  const out = [];
  const push = (raw, kind) => {
    const url = absolutize(raw, base);
    if (url) out.push({ url: url.toString(), kind });
  };
  // Feuilles de style, icônes et préchargements.
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!href) continue;
    const rel = (/rel\s*=\s*["']([^"']+)["']/i.exec(tag) || [, ''])[1].toLowerCase();
    const as = (/as\s*=\s*["']([^"']+)["']/i.exec(tag) || [, ''])[1].toLowerCase();
    if (rel.includes('stylesheet')) push(href[1], 'css');
    else if (rel.includes('icon')) push(href[1], 'img');
    else if (rel.includes('preload') && ['style', 'script', 'image', 'font'].includes(as)) {
      push(href[1], as === 'style' ? 'css' : as === 'script' ? 'js' : as === 'font' ? 'font' : 'img');
    }
  }
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) push(m[1], 'js');
  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) push(m[1], 'img');
  for (const m of html.matchAll(/<(?:source|video|audio)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) push(m[1], 'other');
  for (const m of html.matchAll(/<(?:video)\b[^>]*\bposter\s*=\s*["']([^"']+)["']/gi)) push(m[1], 'img');
  for (const m of html.matchAll(SRCSET)) {
    for (const part of m[1].split(',')) {
      const url = part.trim().split(/\s+/)[0];
      if (url) push(url, 'img');
    }
  }
  // url() et @import dans les styles écrits dans la page.
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const u of m[1].matchAll(CSSURL)) push(u[1], 'img');
    for (const i of m[1].matchAll(CSSIMPORT)) push(i[1] || i[2], 'css');
  }
  for (const m of html.matchAll(/style\s*=\s*["']([^"']*)["']/gi)) {
    for (const u of m[1].matchAll(CSSURL)) push(u[1], 'img');
  }
  return out;
}

/** Les références d'une feuille de style : url() et @import. */
function refsInCss(css, base) {
  const out = [];
  const push = (raw) => {
    const url = absolutize(raw, base);
    if (url) out.push({ url: url.toString(), kind: 'asset' });
  };
  for (const m of css.matchAll(CSSURL)) push(m[1]);
  for (const m of css.matchAll(CSSIMPORT)) push(m[1] || m[2]);
  return out;
}

// --------------------------------------------------------------------- réécriture

function rewriteHtml(html, base, downloaded) {
  // Toutes les références sont calculées depuis la RACINE du site copié (le dossier de
  // « index.html ») : c'est le repère dans lequel le chemin rendu est juste.
  //
  // Ce qui a été téléchargé pointe vers le fichier local ; tout le reste (autre page du site
  // d'origine, ressource trop lourde, fichier introuvable) garde son adresse d'origine — un
  // lien local mort serait pire qu'un lien qui marche.
  const fix = (raw) => {
    const url = absolutize(raw, base);
    if (!url) return raw;
    const local = downloaded.get(url.toString());
    return local ? relativeRef('', local) : url.toString();
  };
  const attr = () => (m, pre, q, value, q2) => `${pre}${q}${fix(value)}${q2}`;
  let out = html;
  out = out.replace(/(<a\b[^>]*\bhref\s*=\s*)(["'])([^"']*)(\2)/gi, attr());
  out = out.replace(/(<link\b[^>]*\bhref\s*=\s*)(["'])([^"']*)(\2)/gi, attr());
  out = out.replace(/(<script\b[^>]*\bsrc\s*=\s*)(["'])([^"']*)(\2)/gi, attr());
  out = out.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']*)(\2)/gi, attr());
  out = out.replace(/(<(?:source|video|audio)\b[^>]*\bsrc\s*=\s*)(["'])([^"']*)(\2)/gi, attr());
  out = out.replace(/(<video\b[^>]*\bposter\s*=\s*)(["'])([^"']*)(\2)/gi, attr());
  out = out.replace(/(srcset\s*=\s*)(["'])([^"']*)(\2)/gi, (m, pre, q, value, q2) => {
    const parts = value
      .split(',')
      .map((part) => {
        const [url, descriptor] = part.trim().split(/\s+/, 2);
        if (!url) return '';
        return descriptor ? `${fix(url)} ${descriptor}` : fix(url);
      })
      .filter(Boolean);
    return `${pre}${q}${parts.join(', ')}${q2}`;
  });
  out = out.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, value) => `url(${q}${fix(value)}${q})`);
  out = out.replace(/(@import\s+)(["'])([^"']+)(\2)/gi, (m, pre, q, value) => `${pre}${q}${fix(value)}${q}`);
  return out;
}

function rewriteCss(css, base, fromDir, downloaded) {
  const fix = (raw) => {
    const url = absolutize(raw, base);
    if (!url) return raw;
    const local = downloaded.get(url.toString());
    return local ? relativeRef(fromDir, local) : url.toString();
  };
  return String(css)
    .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (m, q, value) => `url(${q}${fix(value)}${q})`)
    .replace(/(@import\s+)(["'])([^"']+)(\2)/gi, (m, pre, q, value) => `${pre}${q}${fix(value)}${q}`)
    .replace(/(@import\s+url\(\s*)(["']?)([^"')]+)(\2)(\s*\))/gi, (m, pre, q, value, q2, close) => `${pre}${q}${fix(value)}${q2}${close}`);
}

// --------------------------------------------------------------------- la copie

/**
 * Copie un site en local : page, styles, scripts, images, polices.
 * Renvoie { url, folder, ok, files, bytes, failed, error }.
 */
export async function mirrorSite(rootDir, url, folder, { signal } = {}) {
  const root = path.join(rootDir, folder);
  const result = { url, folder, ok: false, files: [], bytes: 0, failed: [], skipped: [], error: '' };

  let page;
  try {
    page = await get(url, { signal });
  } catch (err) {
    return { ...result, error: `page inaccessible (${err.message})` };
  }
  const base = page.finalUrl;
  const html = page.buffer.toString('utf8');
  if (!/<html|<body|<!doctype/i.test(html.slice(0, 800))) {
    return { ...result, error: 'ce n’est pas une page HTML' };
  }

  // Le plan : chaque adresse devient un fichier local sous « assets/<hôte>/<chemin> ».
  const map = new Map();
  const localFor = (urlText, kind) => {
    let host = 'cdn';
    let chemin = safePath(urlText);
    try {
      host = new URL(urlText).hostname.replace(/[^a-z0-9.-]/gi, '');
    } catch {
      /* hôte illisible : « cdn » fera l'affaire */
    }
    if (!/\.\w{1,5}$/.test(chemin)) {
      const ext = kind === 'css' ? '.css' : kind === 'js' ? '.js' : kind === 'font' ? '.woff2' : '.bin';
      chemin += ext;
    }
    return path.posix.join('assets', host, chemin);
  };

  const queue = [];
  const seen = new Set();
  const add = (urlText, kind, depth = 0) => {
    if (seen.has(urlText) || map.size >= MAX_FILES) return;
    seen.add(urlText);
    const local = localFor(urlText, kind);
    map.set(urlText, local);
    queue.push({ url: urlText, local, kind, depth });
  };

  for (const ref of refsInHtml(html, base)) add(ref.url, ref.kind, 0);

  // Ce qui a été téléchargé pour de bon (adresse d'origine → chemin local).
  const downloaded = new Map();
  const écrits = [];
  let total = 0;
  for (let i = 0; i < queue.length; i += 1) {
    const item = queue[i];
    const cible = path.join(root, item.local);
    try {
      const got = await get(item.url, { signal });
      if (total + got.buffer.length > MAX_TOTAL_BYTES) {
        result.skipped.push(item.url);
        continue;
      }
      fs.mkdirSync(path.dirname(cible), { recursive: true });
      // Une feuille de style se réécrit après téléchargement : ses url() partent aussi en local.
      if (item.kind === 'css' || /\.css(?:\?|$)/i.test(item.url) || got.type.includes('css')) {
        const refs = refsInCss(got.buffer.toString('utf8'), got.finalUrl);
        fs.writeFileSync(cible, got.buffer, 'utf8');
        for (const ref of refs) {
          const avant = map.size;
          add(ref.url, guessKind(ref.url), item.depth + 1);
          if (map.size > avant && item.depth + 1 <= MAX_CSS_DEPTH) {
            // Les ressources d'une feuille de style (images, polices) entrent dans la file.
            const last = queue[queue.length - 1];
            last.depth = item.depth + 1;
          }
        }
      } else {
        fs.writeFileSync(cible, got.buffer);
      }
      écrits.push(item.local);
      downloaded.set(item.url, item.local);
      total += got.buffer.length;
      result.bytes = total;
    } catch (err) {
      result.failed.push(`${item.url} (${err.message})`);
    }
  }

  // La page réécrite, et les feuilles de style réécrites depuis leur propre dossier.
  const htmlLocal = rewriteHtml(html, base, downloaded);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), htmlLocal, 'utf8');
  let cssRewrites = 0;
  for (const [remote, local] of downloaded) {
    const file = path.join(root, local);
    if (!/\.css$/i.test(local)) continue;
    let contenu;
    try {
      contenu = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    // Repère de la feuille de style elle-même, dans le dossier du site : « assets/hôte/css ».
    const fromDir = path.posix.dirname(local);
    fs.writeFileSync(file, rewriteCss(contenu, remote, fromDir, downloaded), 'utf8');
    cssRewrites += 1;
  }

  try {
    fs.writeFileSync(
      path.join(root, 'CLONE.md'),
      [
        `# Copie locale de ${base}`,
        '',
        `Récupérée le ${new Date().toISOString().slice(0, 10)} par XozHub.GPT, pour usage local.`,
        '',
        "Le contenu (textes, images, styles, scripts) reste la propriété de l'éditeur du site",
        "d'origine : cette copie ne doit pas être republiée telle quelle en ligne.",
        '',
        `- fichiers récupérés : ${écrits.length + 1}`,
        `- poids total : ${(total / 1024 / 1024).toFixed(1)} Mo`,
        result.failed.length ? `- non récupérés (laissés en lien absolu) : ${result.failed.length}` : '',
      ]
        .filter(Boolean)
        .join('\n') + '\n',
      'utf8',
    );
  } catch {
    /* sans note, la copie reste utilisable */
  }

  return {
    ...result,
    ok: true,
    files: écrits.concat(['index.html']),
    bytes: total,
    cssRewrites,
  };
}

function guessKind(url) {
  const u = String(url);
  if (/\.css(?:\?|$)/i.test(u)) return 'css';
  if (/\.m?js(?:\?|$)/i.test(u)) return 'js';
  if (/\.(?:png|jpe?g|gif|webp|svg|avif|ico|bmp)(?:\?|$)/i.test(u)) return 'img';
  if (/\.(?:woff2?|ttf|otf|eot)(?:\?|$)/i.test(u)) return 'font';
  return 'asset';
}

/** Une ligne de journal : ce qui a vraiment été copié. */
export function describeClone(result) {
  if (!result.ok) return `Copie impossible : ${result.url} — ${result.error}`;
  return (
    `${result.url} → ${result.folder}/ · ${result.files.length} fichier(s), ${(result.bytes / 1024 / 1024).toFixed(1)} Mo` +
    (result.failed.length ? ` · ${result.failed.length} non récupéré(s)` : '') +
    (result.skipped.length ? ` · ${result.skipped.length} ignoré(s) (trop lourd)` : '')
  );
}

/** Ce que l'agent reçoit après la copie : de quoi il dispose, et ce qui manque. */
export function cloneMessage(result) {
  if (!result.ok) {
    return `[Copie impossible : ${result.url} — ${result.error}]\nDis-le à la personne, et propose autre chose (refaire la page à partir de son analyse) au lieu de faire semblant.`;
  }
  return [
    `[Site copié en local dans ${result.folder}/ — page, styles, scripts, images et polices]`,
    `  ${result.folder}/index.html — point d'entrée de la copie locale (liens réécrits en relatif)`,
    `  ${result.files.length} fichier(s) au total, ${(result.bytes / 1024 / 1024).toFixed(1)} Mo sous ${result.folder}/assets/`,
    result.cssRewrites ? `  ${result.cssRewrites} feuille(s) de style réécrite(s) : leurs url() pointent vers les fichiers locaux` : '',
    result.failed.length ? `  Non récupéré (laissé en lien absolu) : ${result.failed.slice(0, 6).join(' · ')}` : '',
    '',
    'Ce que tu fais maintenant :',
    '- vérifie que la copie s’ouvre et se tient debout (bloc « run » : un serveur local, puis une lecture) ;',
    '- ne réécris PAS ces fichiers pour « faire joli » : c’est une copie, elle doit rester identique ;',
    '- si la personne demande une retouche (enlever une partie, changer une couleur, ajouter une page),',
    '  tu utilises des blocs « edit » sur ces fichiers locaux — et seulement ceux-là.',
  ]
    .filter(Boolean)
    .join('\n');
}
