// XozHub.GPT — la copie locale complète d'un site : le même, vraiment.
//
// Refabriquer un site « dans le même esprit » à partir d'une analyse, c'est une reconstruction.
// Quand on demande LE MÊME site, il n'y a qu'une façon d'y arriver : prendre les pages, leurs
// feuilles de style, leurs scripts, leurs images et leurs polices, les ranger dans un dossier du
// projet, et réécrire tous les liens pour que ça s'ouvre hors ligne, à l'identique.
//
//   ```clone https://exemple.fr
//   ```clone https://exemple.fr mon-site
//
// Ce que l'application fait, et que personne ne veut refaire à la main :
//   - elle ne prend pas que la page d'accueil : elle suit les liens internes du site (menu,
//     pied de page, articles) jusqu'à une profondeur de deux, et copie chaque page en local ;
//   - elle ramasse les ressources sous toutes leurs formes : feuilles de style et leurs url(),
//     @import et @font-face, scripts, images (y compris celles en chargement différé, en
//     data-src et en srcset), icônes, manifeste, polices, vidéos, sons, images de partage
//     (og:image), iframes internes ;
//   - chaque adresse devient un nom de fichier sûr et unique : une ressource servie avec une
//     requête (`style.css?v=3`) ou par un script (`image.php?src=…`) ne vient pas écraser sa
//     voisine, et l'extension finale est celle du type réellement reçu ;
//   - elle réécrit les références DEPUIS LE DOSSIER DE CHAQUE FICHIER — une page dans
//     `blog/article.html` pointe vers `../assets/…`, pas vers `assets/…` — dans le HTML comme
//     dans les feuilles de style ;
//   - ce qui n'a pas pu être pris (trop lourd, introuvable, hors du site) garde son adresse
//     d'origine : un lien qui marche vaut mieux qu'un lien local mort. Elle dit exactement quoi.
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
const MAX_PAGES = 12; // pages internes en plus de la page d'accueil
const MAX_PAGE_DEPTH = 2; // un lien suivi depuis un lien suivi : on s'arrête là
const MAX_FILES = 160;
const MAX_FILE_BYTES = 6_000_000;
const MAX_TOTAL_BYTES = 40_000_000;
const MAX_CSS_DEPTH = 2;
// Ressources téléchargées de front : assez pour aller vite, assez peu pour ne pas se faire
// refuser par un petit serveur.
const CONCURRENCY = 6;

function isClose(line, count) {
  const ticks = String(line).trim();
  return ticks.length >= count && /^`+$/.test(ticks);
}

/** « https://exemple.fr/a/b » → « a/b », nettoyé et sans remontée de dossier. */
function safePath(urlText) {
  let p = '';
  let requete = '';
  try {
    const u = new URL(urlText);
    p = decodeURIComponent(u.pathname);
    requete = u.search.replace(/^\?/, '');
  } catch {
    return 'index';
  }
  const segments = p
    .split('/')
    .filter(Boolean)
    .map((s) => s.replace(/[^\w.\-]+/g, '_').slice(0, 60))
    .filter((s) => s !== '..' && s !== '.');
  // Deux adresses différentes par leur seule requête sont deux fichiers différents : sans cette
  // marque, `style.css?v=1` écraserait `style.css?v=2` — et la copie tiendrait de travers.
  if (requete) {
    const marque = hash8(requete);
    const dernier = segments.pop() || 'index';
    const point = dernier.lastIndexOf('.');
    segments.push(point > 0 ? `${dernier.slice(0, point)}-${marque}${dernier.slice(point)}` : `${dernier}-${marque}`);
  }
  return segments.join('/') || 'index';
}

/** Une empreinte courte et stable, pour distinguer deux adresses qui se ressemblent. */
function hash8(text) {
  let h = 2166136261;
  for (const c of String(text)) {
    h ^= c.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
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

/** Le dossier d'un fichier local, en « / » — « index.html » → « ». */
function dirOf(local) {
  const d = path.posix.dirname(local);
  return d === '.' ? '' : d;
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

// --------------------------------------------------------------------- types de fichiers

// L'extension déduite de ce que le serveur a vraiment renvoyé : un script qui sert une image sous
// « image.php?src=… » ne doit pas finir en « .php » dans un dossier de site.
const EXT_BY_TYPE = [
  [/webmanifest|manifest/i, '.webmanifest'],
  [/html/i, '.html'],
  [/css/i, '.css'],
  [/javascript|ecmascript/i, '.js'],
  [/json/i, '.json'],
  [/svg/i, '.svg'],
  [/png/i, '.png'],
  [/jpe?g/i, '.jpg'],
  [/gif/i, '.gif'],
  [/webp/i, '.webp'],
  [/avif/i, '.avif'],
  [/bmp/i, '.bmp'],
  [/ico|x-icon|vnd\.microsoft\.icon/i, '.ico'],
  [/woff2/i, '.woff2'],
  [/woff/i, '.woff'],
  [/ttf|truetype/i, '.ttf'],
  [/otf|opentype/i, '.otf'],
  [/mpegurl/i, '.m3u8'],
  [/mp4|mpeg/i, '.mp4'],
  [/webm/i, '.webm'],
  [/ogg/i, '.ogg'],
  [/audio\/mpeg/i, '.mp3'],
  [/wav/i, '.wav'],
  [/rss|atom|xml/i, '.xml'],
  [/text\/plain/i, '.txt'],
];

function extFor(type, kind) {
  const t = String(type || '').toLowerCase();
  for (const [re, ext] of EXT_BY_TYPE) if (re.test(t)) return ext;
  if (kind === 'css') return '.css';
  if (kind === 'js') return '.js';
  if (kind === 'font') return '.woff2';
  if (kind === 'page') return '.html';
  return '';
}

// Une extension qui ne dit rien du contenu réel : on la remplace par celle du type reçu.
const EXT_FAUSSE = /\.(?:bin|asset|php\d?|aspx?|jspx?|cgi|pl|do|action)$/i;
// Une adresse se termine-t-elle déjà par une extension exploitable ? (« .webmanifest » compte.)
const A_UNE_EXTENSION = /\.[a-z0-9]{1,12}$/i;

function cheminFinal(local, type, kind) {
  const ext = extFor(type, kind);
  if (!ext) return local;
  const trouve = A_UNE_EXTENSION.exec(local);
  if (!trouve) return `${local}${ext}`;
  return EXT_FAUSSE.test(trouve[0]) ? `${local.slice(0, -trouve[0].length)}${ext}` : local;
}

function guessKind(url) {
  const u = String(url);
  if (/\.css(?:\?|$)/i.test(u)) return 'css';
  if (/\.m?js(?:\?|$)/i.test(u)) return 'js';
  if (/\.(?:png|jpe?g|gif|webp|svg|avif|ico|bmp)(?:\?|$)/i.test(u)) return 'img';
  if (/\.(?:woff2?|ttf|otf|eot)(?:\?|$)/i.test(u)) return 'font';
  return 'asset';
}

/** Un lien interne mène-t-il à une page ? (et pas à un PDF, un ZIP, une recherche…) */
const PAS_UNE_PAGE =
  /\.(?:pdf|zip|rar|7z|gz|tgz|tar|dmg|exe|msi|apk|ipa|docx?|xlsx?|pptx?|csv|txt|xml|json|rss|atom|ics|vcf|mp[34]|m4[av]|mov|avi|webm|og[gv]|wav|mp3|flac|aac|torrent|epub|mobi|svg|png|jpe?g|gif|webp|avif|bmp|ico|woff2?|ttf|otf|eot|css|m?js|cjs|map|wasm|php\d?|cgi|aspx?|jspx?|do|action)(?:$|[?#])/i;
const PAGE_A_EVITER =
  /(?:^|\/)(?:wp-admin|wp-json|wp-login|wp-content\/plugins|cgi-bin|feed|logout|deconnexion|panier|cart|checkout|search|recherche|preview|admin)(?:\/|$)/i;
const QUERELLE_A_EVITER = /[?&](?:s|q|add-to-cart|replytocom|share|logout|action|preview)=/i;

function estUnePage(url) {
  if (PAS_UNE_PAGE.test(url.pathname)) return false;
  if (PAGE_A_EVITER.test(url.pathname)) return false;
  if (QUERELLE_A_EVITER.test(url.search)) return false;
  return true;
}

// --------------------------------------------------------------------- analyse des références

const SRCSET = /srcset\s*=\s*["']([^"']+)["']/gi;
const DATASRCSET = /data-srcset\s*=\s*["']([^"']+)["']/gi;
const CSSURL = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;
const CSSIMPORT = /@import\s+(?:url\(\s*["']?([^"')]+)["']?\s*\)|["']([^"']+)["'])/gi;

/** « url(…adresse…) » → « adresse » : les décors s'écrivent des deux façons. */
function deballe(raw) {
  return String(raw || '')
    .trim()
    .replace(/^url\(\s*["']?/i, '')
    .replace(/["']?\s*\)$/, '');
}

/** Toutes les références d'une page, avec leur nature. `origin` limite les pages au même site. */
function refsInHtml(html, base, origin) {
  const out = [];
  const push = (raw, kind) => {
    const url = absolutize(deballe(raw), base);
    if (!url) return;
    out.push({ url: url.toString(), kind });
  };
  // Les autres pages du site : suivies seulement si elles sont sur le même domaine.
  const pushPage = (raw) => {
    const url = absolutize(deballe(raw), base);
    if (!url || url.origin !== origin || !estUnePage(url)) return;
    out.push({ url: url.toString(), kind: 'page' });
  };

  // Feuilles de style, icônes, préchargements, manifeste.
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const href = /href\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!href) continue;
    const rel = (/rel\s*=\s*["']([^"']+)["']/i.exec(tag) || [, ''])[1].toLowerCase();
    const as = (/as\s*=\s*["']([^"']+)["']/i.exec(tag) || [, ''])[1].toLowerCase();
    if (rel.includes('stylesheet')) push(href[1], 'css');
    else if (/icon|apple-touch|mask-icon/.test(rel)) push(href[1], 'img');
    else if (rel.includes('manifest')) push(href[1], 'asset');
    else if (rel.includes('preload') || rel.includes('prefetch') || rel.includes('modulepreload')) {
      push(
        href[1],
        as === 'style' ? 'css' : as === 'script' ? 'js' : as === 'font' ? 'font' : as === 'image' ? 'img' : 'asset',
      );
    }
  }
  // Navigation interne : c'est ce qui fait qu'on ne copie pas qu'une seule page.
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    const rel = (/rel\s*=\s*["']([^"']+)["']/i.exec(m[0]) || [, ''])[1].toLowerCase();
    if (rel.includes('nofollow') || rel.includes('external')) continue;
    pushPage(m[1]);
  }
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) push(m[1], 'js');
  // Images, y compris celles posées pour le chargement différé et celles d'un <noscript>.
  // On lit la balise entière puis TOUTES ses adresses : sur une image qui porte à la fois
  // « data-src » (l'adresse réelle) et « src » (un pixel de remplacement en data:), s'arrêter à
  // la première rencontrée revient à ne rien copier.
  const IMG_SRC = /(?<![\w-])(?:src|data-src|data-original|data-lazy-src|data-lazy|data-image)\s*=\s*["']([^"']+)["']/gi;
  for (const tag of html.matchAll(/<img\b[^>]*>/gi)) {
    for (const m of tag[0].matchAll(IMG_SRC)) push(m[1], 'img');
  }
  for (const m of html.matchAll(/<(?:source|video|audio|embed|track)\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    push(m[1], 'other');
  }
  // Une iframe du même site est une page : on la copie, sinon on la laisse en lien absolu.
  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const url = absolutize(deballe(m[1]), base);
    if (url && url.origin === origin && estUnePage(url)) push(m[1], 'page');
  }
  for (const m of html.matchAll(/<(?:video)\b[^>]*\bposter\s*=\s*["']([^"']+)["']/gi)) push(m[1], 'img');
  for (const m of html.matchAll(/<object\b[^>]*\bdata\s*=\s*["']([^"']+)["']/gi)) push(m[1], 'other');
  for (const m of html.matchAll(/<input\b[^>]*\btype\s*=\s*["']image["'][^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    push(m[1], 'img');
  }
  for (const re of [SRCSET, DATASRCSET]) {
    for (const m of html.matchAll(re)) {
      for (const part of m[1].split(',')) {
        const url = part.trim().split(/\s+/)[0];
        if (url) push(url, 'img');
      }
    }
  }
  // L'image de partage : sans elle, la copie reste sans visuel dans un lien collé ailleurs.
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/(?:og:image[\w:]*|twitter:image)/i.test(tag)) continue;
    const content = /content\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (content) push(content[1], 'img');
  }
  // Les décors écrits en attribut : « style="background:url(…)" », « data-bg="…" ».
  for (const m of html.matchAll(/style\s*=\s*["']([^"']*)["']/gi)) {
    for (const u of m[1].matchAll(CSSURL)) push(u[1], 'img');
  }
  for (const m of html.matchAll(
    /\bdata-(?:bg|background|background-image|backdrop)\s*=\s*["']([^"']+)["']/gi,
  )) {
    push(m[1], 'img');
  }
  // url() et @import dans les styles écrits dans la page.
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const u of m[1].matchAll(CSSURL)) push(u[1], 'img');
    for (const i of m[1].matchAll(CSSIMPORT)) push(i[1] || i[2], 'css');
  }
  return out;
}

/** Les références d'une feuille de style : url(), @import, et les polices d'@font-face. */
function refsInCss(css, base) {
  const out = [];
  const push = (raw, kind) => {
    const url = absolutize(deballe(raw), base);
    if (url) out.push({ url: url.toString(), kind });
  };
  for (const m of css.matchAll(CSSURL)) push(m[1], 'asset');
  for (const m of css.matchAll(CSSIMPORT)) push(m[1] || m[2], 'css');
  // Une police déclarée sans url() n'existe pas ; mais une police peut venir d'un src en srcset
  // d'image-set(), que CSSURL ramasse déjà.
  for (const m of css.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi)) {
    for (const u of m[1].matchAll(CSSURL)) push(u[1], 'font');
  }
  return out;
}

// --------------------------------------------------------------------- réécriture

function rewriteHtml(html, base, fromDir, downloaded) {
  // Ce qui a été téléchargé pointe vers le fichier local ; tout le reste (autre page du site,
  // ressource trop lourde, fichier introuvable) garde son adresse d'origine — un lien local mort
  // serait pire qu'un lien qui marche.
  const fix = (raw) => {
    const url = absolutize(deballe(raw), base);
    if (!url) return raw;
    const local = downloaded.get(url.toString());
    return local ? relativeRef(fromDir, local) : url.toString();
  };
  // Une srcset est une liste « adresse 1x, adresse 2x » : chaque morceau se traite à part.
  const fixSrcset = (value) =>
    value
      .split(',')
      .map((part) => {
        const [url, descriptor] = part.trim().split(/\s+/, 2);
        if (!url) return '';
        return descriptor ? `${fix(url)} ${descriptor}` : fix(url);
      })
      .filter(Boolean)
      .join(', ');

  // Toutes les adresses passent par la même passe — une balise qui porte à la fois « src » et
  // « data-src » (le chargement différé) voit les deux réécrites, pas seulement la dernière.
  const ATTR_RE =
    /((?<![\w-])(?:href|src|srcset|data-srcset|data-src|data-original|data-lazy-src|data-lazy|data-image|poster|data-bg|data-background|data-background-image|data-backdrop)\s*=\s*)(["'])([^"']*)(\2)/gi;
  let out = html.replace(ATTR_RE, (m, pre, q, value, q2) =>
    /srcset\s*=\s*$/i.test(pre) ? `${pre}${q}${fixSrcset(value)}${q2}` : `${pre}${q}${fix(value)}${q2}`,
  );
  // « data= » d'un <object> : le nom est trop courant pour être pris au passage sans son tag.
  out = out.replace(/(<object\b[^>]*\bdata\s*=\s*)(["'])([^"']*)(\2)/gi, (m, pre, q, value, q2) =>
    `${pre}${q}${fix(value)}${q2}`,
  );

  // L'image de partage se cache dans un « content=… » selon l'ordre des attributs.
  out = out.replace(/<meta\b[^>]*>/gi, (tag) => {
    if (!/(?:og:image[\w:]*|twitter:image)/i.test(tag)) return tag;
    return tag.replace(/(content\s*=\s*)(["'])([^"']*)(\2)/i, (m, pre, q, value, q2) => `${pre}${q}${fix(value)}${q2}`);
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
    .replace(
      /(@import\s+url\(\s*)(["']?)([^"')]+)(\2)(\s*\))/gi,
      (m, pre, q, value, q2, close) => `${pre}${q}${fix(value)}${q2}${close}`,
    );
}

/** Le texte qu'un humain voit : ce qui reste quand on enlève le code. */
function texteVisible(html) {
  return String(html)
    .replace(/<(?:script|style|noscript)[\s\S]*?<\/(?:script|style|noscript)>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --------------------------------------------------------------------- la copie

/**
 * Copie un site en local : ses pages, ses styles, ses scripts, ses images, ses polices.
 * Renvoie { url, folder, ok, files, pages, bytes, failed, skipped, spa, error }.
 *   « pages » : les fichiers HTML écrits, dans l'ordre de découverte.
 *   « spa »   : la page est une coquille rendue par JavaScript — la copie locale ne peut pas
 *               montrer le contenu sans le serveur, et il vaut mieux le dire que le cacher.
 */
export async function mirrorSite(rootDir, url, folder, { signal, pages: maxPages = MAX_PAGES } = {}) {
  const root = path.join(rootDir, folder);
  const result = {
    url,
    folder,
    ok: false,
    files: [],
    pages: [],
    pagesSkipped: [],
    bytes: 0,
    failed: [],
    skipped: [],
    spa: false,
    error: '',
  };

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
  const origin = new URL(base).origin;

  // Le plan : chaque adresse devient un fichier local, et rien ne se marche dessus.
  const used = new Set();
  const map = new Map(); // adresse → chemin prévu (planning)
  const seen = new Set();
  const queue = [];
  const pagesHtml = new Map(); // adresse → { html, base, local } — écrit à la fin
  const downloaded = new Map(); // adresse → chemin réellement écrit
  const écrits = [];
  const pagesIgnorees = new Set(); // pages du site repérées mais non copiées (budget)
  let total = 0;
  let pagesVues = 1;

  const unique = (local) => {
    if (!used.has(local)) {
      used.add(local);
      return local;
    }
    const dir = path.posix.dirname(local);
    const nom = path.posix.basename(local);
    const point = nom.lastIndexOf('.');
    const tige = point > 0 ? nom.slice(0, point) : nom;
    const ext = point > 0 ? nom.slice(point) : '';
    let i = 2;
    let essai = path.posix.join(dir, `${tige}-${i}${ext}`);
    while (used.has(essai)) {
      i += 1;
      essai = path.posix.join(dir, `${tige}-${i}${ext}`);
    }
    used.add(essai);
    return essai;
  };

  const localAsset = (urlText, kind) => {
    let rel = safePath(urlText);
    if (!A_UNE_EXTENSION.test(rel)) rel += extFor('', kind) || '.bin';
    let host = 'cdn';
    try {
      host = new URL(urlText).hostname.replace(/[^a-z0-9.-]/gi, '') || 'cdn';
    } catch {
      /* hôte illisible : « cdn » fera l'affaire */
    }
    return unique(path.posix.join('assets', host, rel));
  };

  // Une page du site devient « blog/article.html », la page d'accueil « index.html ».
  const localPage = (urlText) => {
    let p = '';
    try {
      p = decodeURIComponent(new URL(urlText).pathname);
    } catch {
      p = '';
    }
    const segments = p
      .split('/')
      .filter(Boolean)
      .map((s) => s.replace(/[^\w.\-]+/g, '_').slice(0, 60))
      .filter((s) => s !== '..' && s !== '.');
    if (!segments.length) return unique('index.html');
    const dernier = segments[segments.length - 1];
    segments[segments.length - 1] = /\.(?:x?html?)$/i.test(dernier)
      ? dernier.replace(/\.(?:xhtml|html)$/i, '.html')
      : `${dernier}.html`;
    return unique(segments.join('/'));
  };

  const add = (urlText, kind, depth = 0) => {
    if (!urlText || seen.has(urlText) || downloaded.has(urlText) || map.size >= MAX_FILES) return;
    if (kind === 'page' && pagesVues >= 1 + maxPages) {
      pagesIgnorees.add(urlText);
      return;
    }
    seen.add(urlText);
    const local = kind === 'page' ? localPage(urlText) : localAsset(urlText, kind);
    if (kind === 'page') pagesVues += 1;
    map.set(urlText, local);
    queue.push({ url: urlText, local, kind, depth });
  };

  // La page d'accueil est déjà prise : un lien « retour à l'accueil » depuis une page
  // intérieure ne doit pas la faire copier une seconde fois sous un autre nom.
  seen.add(base);
  if (url !== base) seen.add(url);
  used.add('index.html');
  pagesHtml.set(base, { html, base, local: 'index.html' });
  downloaded.set(base, 'index.html');
  if (url !== base) downloaded.set(url, 'index.html');
  result.pages.push({ url: base, local: 'index.html' });
  for (const ref of refsInHtml(html, base, origin)) add(ref.url, ref.kind, 0);

  async function téléchargeUn(item) {
    const cible = path.join(root, item.local);
    try {
      const got = await get(item.url, { signal });
      if (total + got.buffer.length > MAX_TOTAL_BYTES) {
        result.skipped.push(item.url);
        return;
      }
      if (item.kind === 'page') {
        const texte = got.buffer.toString('utf8');
        if (!/<html|<body|<!doctype/i.test(texte.slice(0, 800))) {
          result.failed.push(`${item.url} (ce n’est pas une page HTML)`);
          return;
        }
        pagesHtml.set(item.url, { html: texte, base: got.finalUrl, local: item.local });
        downloaded.set(item.url, item.local);
        result.pages.push({ url: item.url, local: item.local });
        total += got.buffer.length;
        result.bytes = total;
        for (const ref of refsInHtml(texte, got.finalUrl, origin)) {
          if (ref.kind === 'page' && item.depth >= MAX_PAGE_DEPTH) continue;
          add(ref.url, ref.kind, item.depth + 1);
        }
        return;
      }
      const local = cheminFinal(item.local, got.type, item.kind);
      fs.mkdirSync(path.dirname(path.join(root, local)), { recursive: true });
      // Une feuille de style se réécrit après téléchargement : ses url() partent aussi en local.
      if (item.kind === 'css' || /\.css(?:[?#]|$)/i.test(item.url) || got.type.includes('css')) {
        fs.writeFileSync(path.join(root, local), got.buffer, 'utf8');
        if (item.depth < MAX_CSS_DEPTH) {
          for (const ref of refsInCss(got.buffer.toString('utf8'), got.finalUrl)) {
            add(ref.url, ref.kind === 'asset' ? guessKind(ref.url) : ref.kind, item.depth + 1);
          }
        }
      } else {
        fs.writeFileSync(path.join(root, local), got.buffer);
      }
      écrits.push(local);
      downloaded.set(item.url, local);
      total += got.buffer.length;
      result.bytes = total;
    } catch (err) {
      result.failed.push(`${item.url} (${err.message})`);
    }
  }

  // Les fichiers d'un même « étage » partent ensemble : une page qui traîne quarante ressources
  // demandait quarante allers-retours à la queue leu leu, elle n'en demande plus que quelques-uns.
  // Les ressources découvertes ensuite entrent dans la file et sont prises au lot suivant : la
  // profondeur des dépendances reste respectée.
  while (queue.length) {
    const lot = queue.splice(0, CONCURRENCY);
    await Promise.all(lot.map((item) => téléchargeUn(item)));
  }

  // Les pages : chacune est réécrite depuis SON dossier, pour que « ../assets/… » soit juste.
  for (const info of pagesHtml.values()) {
    const fichier = path.join(root, info.local);
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    fs.writeFileSync(fichier, rewriteHtml(info.html, info.base, dirOf(info.local), downloaded), 'utf8');
    if (!écrits.includes(info.local)) écrits.push(info.local);
  }
  // Les feuilles de style, réécrites depuis leur propre dossier.
  let cssRewrites = 0;
  for (const [remote, local] of downloaded) {
    if (!/\.css$/i.test(local)) continue;
    const fichier = path.join(root, local);
    if (!fs.existsSync(fichier)) continue;
    try {
      fs.writeFileSync(
        fichier,
        rewriteCss(fs.readFileSync(fichier, 'utf8'), remote, dirOf(local), downloaded),
        'utf8',
      );
      cssRewrites += 1;
    } catch {
      /* une feuille de style illisible reste telle quelle : la copie tient encore debout */
    }
  }

  // Une page dont le texte visible tient en quelques mots et qui charge des scripts est une
  // coquille : son contenu est fabriqué par le navigateur. La copie locale ne le montrera pas.
  result.spa = texteVisible(html).length < 400 && /<script\b/i.test(html);

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
        `- pages copiées : ${result.pages.length}`,
        ...result.pages.map((p) => `  - ${p.local} ← ${p.url}`),
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
    files: [...new Set(écrits)],
    bytes: total,
    pagesSkipped: [...pagesIgnorees],
    cssRewrites,
  };
}

/** Une ligne de journal : ce qui a vraiment été copié. */
export function describeClone(result) {
  if (!result.ok) return `Copie impossible : ${result.url} — ${result.error}`;
  return (
    `${result.url} → ${result.folder}/ · ${result.files.length} fichier(s), ${result.pages.length} page(s), ${(result.bytes / 1024 / 1024).toFixed(1)} Mo` +
    (result.failed.length ? ` · ${result.failed.length} non récupéré(s)` : '') +
    (result.skipped.length ? ` · ${result.skipped.length} ignoré(s) (trop lourd)` : '') +
    (result.pagesSkipped && result.pagesSkipped.length ? ` · ${result.pagesSkipped.length} page(s) du site non copiée(s)` : '') +
    (result.spa ? ' · page rendue par JavaScript' : '')
  );
}

/** Ce que l'agent reçoit après la copie : de quoi il dispose, et ce qui manque. */
export function cloneMessage(result) {
  if (!result.ok) {
    return `[Copie impossible : ${result.url} — ${result.error}]\nDis-le à la personne, et propose autre chose (refaire la page à partir de son analyse avec un bloc « fetch ») au lieu de faire semblant.`;
  }
  const autres = result.pages.filter((p) => p.local !== 'index.html');
  return [
    `[Site copié en local dans ${result.folder}/ — ${result.pages.length} page(s), styles, scripts, images et polices]`,
    `  ${result.folder}/index.html — point d'entrée de la copie locale (liens réécrits en relatif)`,
    ...autres.map((p) => `  ${result.folder}/${p.local} — ${p.url}`),
    `  ${result.files.length - result.pages.length} fichier(s) de ressources, ${(result.bytes / 1024 / 1024).toFixed(1)} Mo sous ${result.folder}/assets/`,
    result.cssRewrites
      ? `  ${result.cssRewrites} feuille(s) de style réécrite(s) : leurs url() pointent vers les fichiers locaux`
      : '',
    result.failed.length
      ? `  Non récupéré (laissé en lien absolu pour que la page reste utilisable) : ${result.failed.slice(0, 6).join(' · ')}`
      : '',
    result.skipped.length ? `  Trop lourd, laissé en lien absolu : ${result.skipped.length} fichier(s)` : '',
    result.pagesSkipped && result.pagesSkipped.length
      ? `  ${result.pagesSkipped.length} autre(s) page(s) du site repérée(s) mais NON copiée(s) (limite de ${MAX_PAGES} pages) — ne dis pas que le site est entier ; pour en avoir une, un bloc « clone » sur son adresse exacte.`
      : '',
    result.spa
      ? '  ATTENTION : cette page est une coquille rendue par JavaScript — sa copie locale est vide de contenu. Dis-le à la personne au lieu de faire croire que tout est là ; pour ce genre de site, on reconstruit à partir du bloc « fetch ».'
      : '',
    '',
    'Ce que tu fais maintenant :',
    '- vérifie que la copie s’ouvre et se tient debout (bloc « run » : un serveur local, puis une lecture) ;',
    '- parcours au moins la page d’accueil ET une page intérieure : la navigation doit rester dans le dossier ;',
    '- ne réécris PAS ces fichiers pour « faire joli » : c’est une copie, elle doit rester identique ;',
    '- si la personne demande une retouche (enlever une partie, changer une couleur, ajouter une page),',
    '  tu utilises des blocs « edit » sur ces fichiers locaux — et seulement ceux-là.',
  ]
    .filter(Boolean)
    .join('\n');
}
