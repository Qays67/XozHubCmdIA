// XozHub.GPT — lire un site à partir de son adresse, pour pouvoir le refaire.
//
// Donner un lien à l'agent ne sert à rien s'il ne peut pas l'ouvrir : il inventerait une page
// « dans le style » en devinant tout. Ici, l'application télécharge la page elle-même, écarte
// le bruit (scripts, traqueurs, commentaires), et en tire une carte de visite complète :
// la structure de la page dans l'ordre, les vrais textes, les polices réellement utilisées,
// les images, et surtout la palette — les couleurs du site, telles qu'elles sont écrites.
//
// Avec ça, « refais-moi ce site » n'est plus une devinette : c'est une reconstruction.
//
//   ```fetch https://exemple.fr
//   ```fetch https://exemple.fr/tarifs
//
// Rien n'est écrit sur le disque : on lit, on résume, et on donne à l'agent de quoi refaire.

const MAX_HTML = 22_000;
const MAX_CSS_EACH = 12_000;
const MAX_CSS_FILES = 3;
const MAX_TOTAL = 60_000;
const TIMEOUT_MS = 15_000;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

// ```fetch adresse
const OPEN = /^(`{3,})(?:fetch|url|lien|site|page|http|https)[\s:]+(.+?)\s*$/i;

function isClose(line, count) {
  const ticks = String(line).trim();
  return ticks.length >= count && /^`+$/.test(ticks);
}

/** Repère les blocs « fetch » d'une réponse, dans l'ordre. Renvoie les adresses. */
export function parseFetches(text) {
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
    // Le premier mot suffit : une adresse ne contient pas d'espace.
    const url = normalizeUrl(String(open[2]).trim().split(/\s+/)[0]);
    if (url) out.push(url);
  }
  return out;
}

/**
 * Les adresses http(s) écrites dans un texte — un lien collé dans la demande.
 * On ne devine rien : seules les adresses explicites comptent (pas de domaine nu, qui
 * confondrait « index.html » avec un site).
 */
export function urlsIn(text, max = 2) {
  const found = [];
  for (const m of String(text ?? '').matchAll(/https?:\/\/[^\s<>"'`)\]}]+/gi)) {
    const url = normalizeUrl(m[0].replace(/[.,;:!?]+$/, ''));
    if (url && !found.includes(url)) found.push(url);
    if (found.length >= max) break;
  }
  return found;
}

/** Ajoute le schéma manquant, enlève le bruit d'ancre, refuse ce qui n'est pas du http(s). */
export function normalizeUrl(raw) {
  let text = String(raw ?? '').trim().replace(/^["'`<]|[>"'`]$/g, '');
  if (!text) return '';
  if (text.startsWith('//')) text = `https:${text}`;
  if (!/^https?:\/\//i.test(text)) {
    if (!/^[\w-]+(\.[\w-]+)+/.test(text)) return '';
    text = `https://${text}`;
  }
  try {
    const url = new URL(text);
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

/** Le texte sans les blocs « fetch » : ce qui reste à afficher. */
export function stripFetches(text) {
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

/** Le texte avec les blocs « fetch » remplacés par une marque. */
export function foldFetches(text) {
  const out = [];
  let ticks = 0;
  for (const line of String(text ?? '').split('\n')) {
    if (ticks) {
      if (isClose(line, ticks)) {
        ticks = 0;
        out.push('… (adresse consultée) …', line);
      }
      continue;
    }
    const open = OPEN.exec(line);
    if (open) ticks = open[1].length;
    out.push(line);
  }
  return out.join('\n');
}

// --------------------------------------------------------------------- nettoyage

function stripTags(html) {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, '’')
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Enlève ce qui ne sert pas à comprendre une page : scripts, styles, SVG, commentaires. */
function cleanHtml(html) {
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, (m) => `\n<style>${m.replace(/^<style[^>]*>/i, '').replace(/<\/style>$/i, '')}</style>\n`)
    .replace(/\sdata-[\w-]+="[^"]*"/gi, '')
    .replace(/\saria-hidden="true"/gi, '');
}

/** Compacte une feuille de style : commentaires et espaces inutiles en moins. */
function cleanCss(css, limit = MAX_CSS_EACH) {
  let out = String(css)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .replace(/\}/g, '}\n')
    .trim();
  // Les images en base64 ne disent rien du design : on les remplace par leur taille.
  out = out.replace(/url\(\s*["']?data:[^)]{200,}["']?\s*\)/gi, 'url(data:image/…tronquée)');
  if (out.length > limit) out = `${out.slice(0, limit)}\n… (CSS tronqué)`;
  return out;
}

// --------------------------------------------------------------------- couleurs

const HEX = /#[0-9a-f]{3,8}\b/gi;
const RGB = /rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/gi;

const hex2 = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

/** Toutes les couleurs d'un texte de style, avec leur nombre d'apparitions. */
function colorsIn(text) {
  const counts = new Map();
  const bump = (hexColor) => {
    const key = normalizeHex(hexColor);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (const m of String(text).matchAll(HEX)) bump(m[0]);
  for (const m of String(text).matchAll(RGB)) {
    bump(`#${hex2(Number(m[1]))}${hex2(Number(m[2]))}${hex2(Number(m[3]))}`);
  }
  return counts;
}

/** « #abc » → « #aabbcc », minuscules ; null si ce n'est pas une couleur exploitable. */
function normalizeHex(value) {
  let h = String(value || '').trim().toLowerCase();
  if (!h.startsWith('#')) return null;
  if (h.length === 4) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (h.length === 5) h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}${h[4]}${h[4]}`;
  if (h.length !== 7 && h.length !== 9) return null;
  return h.slice(0, 7);
}

function rgbOf(hexColor) {
  const h = String(hexColor).replace('#', '');
  const n = Number.parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Saturation approximative (0 = gris, 1 = couleur pure) et clarté (0 = noir, 1 = blanc). */
function hsv(hexColor) {
  const [r, g, b] = rgbOf(hexColor).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return { sat: max === 0 ? 0 : (max - min) / max, val: max };
}

/**
 * Le contenu réel de la page : chaque titre, suivi du texte et des listes qui l'accompagnent.
 * C'est ce qui permet de refaire la MÊME page : la structure ne suffit pas, il faut les mots.
 */
function sectionsOf(html) {
  const marks = [];
  for (const m of html.matchAll(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    marks.push({ tag: m[1].toLowerCase(), title: stripTags(m[3]), at: m.index });
  }
  const out = [];
  for (let i = 0; i < marks.length; i += 1) {
    const start = marks[i].at;
    const end = i + 1 < marks.length ? marks[i + 1].at : Math.min(html.length, start + 14_000);
    const zone = html.slice(start, end);
    const paragraphs = [...zone.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripTags(m[1]))
      .filter((t) => t.length > 2);
    const items = [...zone.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripTags(m[1]))
      .filter((t) => t.length > 1);
    if (!paragraphs.length && !items.length) continue;
    out.push({
      tag: marks[i].tag,
      title: marks[i].title,
      paragraphs: paragraphs.slice(0, 4).map((t) => t.slice(0, 240)),
      items: items.slice(0, 8).map((t) => t.slice(0, 140)),
    });
    if (out.length >= 14) break;
  }
  return out;
}

/**
 * Les mesures du CSS : c'est ce qui donne les proportions d'un site. Une page refaite avec les
 * bonnes couleurs mais des paddings inventés ne ressemble pas à l'original ; avec ses largeurs,
 * ses tailles de texte et ses points de rupture, si.
 */
function measuresOf(css) {
  const grab = (re) => [...String(css).matchAll(re)].map((m) => String(m[1] || '').trim()).filter(Boolean);
  const top = (arr, max = 5) => {
    const map = new Map();
    for (const v of arr) map.set(v, (map.get(v) || 0) + 1);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, max)
      .map(([v, n]) => (n > 1 ? `${v} (×${n})` : v));
  };
  return {
    largeurs: top(grab(/max-width\s*:\s*([^;}]+)/gi), 4),
    paddings: top(grab(/padding(?:-block|-inline)?\s*:\s*([^;}]+)/gi), 6),
    marges: top(grab(/margin(?:-block|-top|-bottom)?\s*:\s*([^;}]+)/gi), 5),
    ecarts: top(grab(/\bgap\s*:\s*([^;}]+)/gi), 4),
    tailles: top(grab(/font-size\s*:\s*([^;}]+)/gi), 8),
    arrondis: top(grab(/border-radius\s*:\s*([^;}]+)/gi), 4),
    ombres: top(grab(/box-shadow\s*:\s*([^;}]+)/gi), 3),
    grilles: top(grab(/grid-template-columns\s*:\s*([^;}]+)/gi), 4),
    agencements: top(grab(/display\s*:\s*(grid|inline-grid|flex|inline-flex)/gi), 4),
    ruptures: top(grab(/@media[^{]{0,60}?\(([^)]{3,50})\)/gi), 5),
    transitions: top(grab(/transition\s*:\s*([^;}]+)/gi), 3),
  };
}

/** Les couleurs d'un texte de style, publiques cette fois (sert au contrôle de fidélité). */
export function colorsInText(text) {
  return [...colorsIn(text).keys()];
}

/** Les variables CSS déclarées : c'est là que se cache la vraie palette d'un site. */
function cssVariables(text) {
  const out = [];
  for (const m of String(text).matchAll(/--([\w-]{2,40})\s*:\s*([^;}]{1,80})[;}]/g)) {
    const value = m[2].trim();
    if (/#[0-9a-f]{3,8}\b/i.test(value) || /rgba?\(/i.test(value)) out.push(`--${m[1]}: ${value}`);
  }
  return [...new Set(out)].slice(0, 24);
}

/** La palette d'un site, classée : le fond, l'accent, les textes, le reste. */
function paletteOf(text, extra = []) {
  const counts = colorsIn(`${text}\n${extra.join('\n')}`);
  const list = [...counts.entries()]
    .map(([hexColor, n]) => ({ hex: hexColor, n, ...hsv(hexColor) }))
    .sort((a, b) => b.n - a.n);
  if (!list.length) return null;
  const total = list.reduce((sum, c) => sum + c.n, 0);
  const top = (arr) => [...arr].sort((a, b) => b.n - a.n)[0] || null;
  const accent = top(list.filter((c) => c.sat > 0.35 && c.val > 0.35)) || null;
  const surface = top(list.filter((c) => c.sat < 0.2)) || null;
  return {
    all: list.slice(0, 14).map((c) => ({ hex: c.hex, share: Math.round((c.n / total) * 100), sat: c.sat, val: c.val })),
    dominant: list[0],
    accent,
    surface,
  };
}

// --------------------------------------------------------------------- structure

/** Le plan de la page : les blocs dans l'ordre, avec leurs titres et leurs textes. */
function outline(html) {
  const lines = [];
  const push = (label, text) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean) lines.push(`${'  '.repeat(label.indent)}${label.tag}${label.attr ? ` ${label.attr}` : ''} — « ${clean.slice(0, 160)} »`);
  };

  // Titres, dans l'ordre du document.
  for (const m of html.matchAll(/<(h[1-6])([^>]*)>([\s\S]*?)<\/\1>/gi)) {
    push({ tag: m[1].toLowerCase(), attr: '' }, stripTags(m[3]));
  }
  // Liens de navigation : ce que contient le menu.
  const nav = /<nav[\s\S]*?<\/nav>/i.exec(html);
  if (nav) {
    const links = [...nav[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
    if (links.length) lines.push(`  nav — ${links.length} lien(s) : ${links.slice(0, 10).join(' · ')}`);
  }
  // Boutons et appels à l'action.
  const actions = [...html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)]
    .filter((m) => /class="[^"]*(btn|button|cta)/i.test(m[2]))
    .map((m) => stripTags(m[3]))
    .filter(Boolean);
  if (actions.length) lines.push(`  boutons — ${[...new Set(actions)].slice(0, 8).join(' · ')}`);
  // Décors : ce qui structure la page.
  const counts = {};
  for (const tag of ['header', 'section', 'article', 'aside', 'footer', 'form', 'nav']) {
    counts[tag] = (html.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
  }
  const structure = Object.entries(counts)
    .filter(([, n]) => n)
    .map(([tag, n]) => `${tag}×${n}`)
    .join(' · ');
  return { lines, structure };
}

/** Les images réellement utilisées, en adresse absolue. */
function imagesOf(html, base) {
  const out = [];
  const add = (raw) => {
    const src = String(raw || '').trim();
    if (!src || /^data:/i.test(src)) return;
    try {
      const abs = new URL(src, base).toString();
      if (!out.includes(abs)) out.push(abs);
    } catch {
      /* adresse illisible : ignorée */
    }
  };
  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of html.matchAll(/<source\b[^>]*\bsrcset=["']([^"' ,]+)/gi)) add(m[1]);
  return out.slice(0, 25);
}

/** Les feuilles de style liées, en adresse absolue. */
function styleSheets(html, base) {
  const out = [];
  for (const m of html.matchAll(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi)) {
    const href = /\bhref=["']([^"']+)["']/i.exec(m[0]);
    if (!href) continue;
    try {
      const abs = new URL(href[1], base).toString();
      if (!out.includes(abs)) out.push(abs);
    } catch {
      /* ignorée */
    }
  }
  return out.slice(0, MAX_CSS_FILES);
}

/** Les polices chargées (Google Fonts ou déclarations directes). */
function fontsOf(html, css) {
  const out = [];
  for (const m of html.matchAll(/fonts\.googleapis\.com\/[^"')\s]+/gi)) out.push(m[0]);
  for (const m of String(css).matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
    const family = m[1].split(',')[0].replace(/["']/g, '').trim();
    if (family && !/^(inherit|initial|unset|var\()/i.test(family)) out.push(family);
  }
  return [...new Set(out)].slice(0, 8);
}

// --------------------------------------------------------------------- visite

async function getText(url, { signal, accept } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (signal) signal.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': UA, accept: accept || 'text/html,application/xhtml+xml,*/*;q=0.8' },
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, url: res.url || url, type: res.headers.get('content-type') || '', body };
  } catch (err) {
    throw new Error(
      err && err.name === 'AbortError' ? 'délai dépassé (15 s)' : (err && err.message) || 'requête impossible',
    );
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

/**
 * Visite une adresse et renvoie de quoi la refaire.
 * Renvoie { url, ok, kind, summary, error } :
 *   « summary » est le texte donné à l'agent — structure, textes, polices, images, palette.
 */
export async function visit(url, { signal } = {}) {
  const base = { url, ok: false, kind: '', summary: '', error: '' };
  let page;
  try {
    page = await getText(url, { signal });
  } catch (err) {
    return { ...base, error: err.message };
  }
  if (!page.ok) return { ...base, error: `HTTP ${page.status}` };

  const type = page.type.toLowerCase();
  const isHtml = type.includes('html') || /<html|<body|<!doctype/i.test(page.body.slice(0, 600));

  // Ce n'est pas une page : on rend le fichier (CSS, JS, JSON, texte…).
  if (!isHtml) {
    // Une feuille de style se compacte comme les autres ; un .js ou un .json se lit tel quel.
    const isCss = type.includes('css') || /\.css(?:\?|$)/i.test(page.url);
    const body = isCss ? cleanCss(page.body) : page.body.slice(0, MAX_CSS_EACH);
    const cut = !isCss && page.body.length > MAX_CSS_EACH ? '… (fichier tronqué) …' : '';
    return {
      ...base,
      ok: true,
      kind: 'fichier',
      summary: `[Contenu de ${page.url} — ${type || 'type inconnu'}, ${page.body.length} octets]\n${body}${cut ? `\n${cut}` : ''}`,
    };
  }

  const html = cleanHtml(page.body);

  // Les feuilles de style liées : c'est là que se trouve le vrai design.
  const sheets = [];
  let cssAll = '';
  const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  cssAll += inlineCss;
  for (const href of styleSheets(html, page.url)) {
    try {
      const res = await getText(href, { signal, accept: 'text/css,*/*;q=0.1' });
      if (!res.ok) continue;
      const css = cleanCss(res.body);
      sheets.push({ href, css });
      cssAll += `\n${res.body}`;
      if (cssAll.length > MAX_TOTAL) break;
    } catch {
      /* une feuille de style inaccessible ne bloque pas la visite */
    }
  }

  const palette = paletteOf(cssAll || html, [inlineCss]);
  const variables = cssVariables(cssAll);
  const { lines, structure: shape } = outline(html);
  const sections = sectionsOf(html);
  const measures = measuresOf(cssAll);
  const images = imagesOf(html, page.url);
  const fonts = fontsOf(page.body, cssAll);
  const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [, ''])[1].replace(/\s+/g, ' ').trim();
  const description = (/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) || [, ''])[1];
  const lang = (/<html[^>]*\blang=["']([^"']+)["']/i.exec(html) || [, ''])[1];

  const parts = [
    `[Site visité par l'application : ${page.url}]`,
    title ? `Titre : « ${title} »` : '',
    description ? `Description : « ${description} »` : '',
    lang ? `Langue : ${lang}` : '',
    shape ? `Structure : ${shape}` : '',
    fonts.length ? `Polices : ${fonts.join(' · ')}` : '',
    '',
  ];

  if (palette) {
    parts.push(
      'Palette du site — reprends EXACTEMENT ces teintes :',
      ...palette.all.map((c) => {
        const role = c.hex === palette.dominant.hex ? 'fond dominant' : c.sat < 0.15 ? 'neutre' : c.val < 0.4 ? 'sombre' : 'accent / teinte';
        return `  ${c.hex}  ${String(c.share).padStart(3)}%  ${role}`;
      }),
      palette.accent ? `Couleur d’accent la plus saturée : ${palette.accent.hex}` : '',
      '',
    );
  }
  if (variables.length) parts.push('Variables CSS déclarées par le site :', ...variables.map((v) => `  ${v}`), '');

  parts.push('Plan de la page, dans l’ordre :', ...(lines.length ? lines : ['  (rien de lisible)']), '');

  if (sections.length) {
    parts.push('Contenu réel de la page — reprends ces textes, dans cet ordre :');
    for (const s of sections) {
      parts.push(`  <${s.tag}> ${s.title ? `« ${s.title} »` : ''}`);
      for (const p of s.paragraphs) parts.push(`      ${p}`);
      for (const i of s.items) parts.push(`      · ${i}`);
    }
    parts.push('');
  }

  const mesures = Object.entries(measures).filter(([, v]) => v.length);
  if (mesures.length) {
    parts.push('Mesures relevées dans le CSS — garde les mêmes proportions :');
    for (const [nom, valeurs] of mesures) parts.push(`  ${nom} : ${valeurs.join(' · ')}`);
    parts.push('');
  }
  if (images.length) parts.push(`Images (${images.length}) — recrée-les en SVG ou en dégradé, jamais de lien cassé :`, ...images.map((i) => `  ${i}`), '');

  if (sheets.length) {
    parts.push('Feuilles de style du site (pour comprendre les mesures, les espacements et les grilles) :');
    for (const sheet of sheets) parts.push(`--- ${sheet.href} ---`, sheet.css, '');
  } else if (inlineCss.trim()) {
    parts.push('CSS écrit dans la page :', cleanCss(inlineCss), '');
  }

  let summary = parts.filter((p) => p !== '').join('\n');
  if (summary.length > MAX_TOTAL) {
    summary = `${summary.slice(0, MAX_TOTAL)}\n… (résumé tronqué à ${MAX_TOTAL} caractères) …`;
  }
  // La cible, en forme exploitable : elle sert à l'application pour rappeler à l'agent ce
  // qu'il reproduit, et pour mesurer la fidélité des couleurs une fois le site refait.
  const target = {
    url: page.url,
    title,
    palette: palette ? palette.all.map((c) => c.hex) : [],
    dominant: palette && palette.dominant ? palette.dominant.hex : '',
    accent: palette && palette.accent ? palette.accent.hex : '',
    sections: sections.map((s) => s.title || `<${s.tag}>`),
    fonts,
  };
  return { ...base, ok: true, kind: 'page', summary, target };
}

/** Ce qu'on écrit dans le journal : une visite, en une ligne. */
export function describeVisit(result) {
  if (!result.ok) return `Visite impossible : ${result.url} — ${result.error}`;
  const kind = result.kind === 'page' ? 'page analysée' : 'fichier récupéré';
  return `${result.url} · ${kind} · ${result.summary.length} caractères utiles`;
}

/** Le paquet renvoyé au modèle après une ou plusieurs visites. */
export function visitsMessage(results) {
  return (results || [])
    .map((r) => (r.ok ? r.summary : `[Visite impossible : ${r.url} — ${r.error}]`))
    .join('\n\n---\n\n');
}
