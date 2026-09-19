// XozHub.GPT — palette « aurore » : un dégradé complet indigo → violet → magenta → rose → cyan →
// menthe, avec des familles de couleurs bien séparées selon le rôle du contenu (chaud pour toi,
// froid pour l'IA, menthe pour les commandes, corail pour les erreurs).
// Toutes les teintes sont calculées ici : rien à installer.
//
// Le mode couleur s'adapte au terminal : truecolor (24 bits) quand il sait le faire, sinon
// 256 couleurs, sinon les 16 couleurs de base — donc il y a TOUJOURS de la couleur à l'écran.
// Réglage manuel : XOZHUB_COLOR=truecolor|256|16|none (NO_COLOR=1 coupe tout).

export const RESET = '\x1b[0m';

function toRgb(hex) {
  let h = String(hex).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// --------------------------------------------------------------------- mode couleur

/** Rampe de gris + cube 6×6×6 de la palette xterm-256. */
const CUBE = [0, 95, 135, 175, 215, 255];

function nearestCube(v) {
  let best = 0;
  let dist = Infinity;
  for (let i = 0; i < CUBE.length; i += 1) {
    const d = Math.abs(v - CUBE[i]);
    if (d < dist) {
      dist = d;
      best = i;
    }
  }
  return best;
}

/** Teinte hex → index xterm-256 (cube 6×6×6 ou rampe de gris). */
export function toAnsi256(hex) {
  const [r, g, b] = toRgb(hex);
  const ri = nearestCube(r);
  const gi = nearestCube(g);
  const bi = nearestCube(b);
  const cube = 16 + 36 * ri + 6 * gi + bi;
  const cubeDist =
    (r - CUBE[ri]) ** 2 + (g - CUBE[gi]) ** 2 + (b - CUBE[bi]) ** 2;
  const level = Math.min(23, Math.max(0, Math.round(((r + g + b) / 3 - 8) / 10)));
  const gray = 8 + level * 10;
  const grayDist = (r - gray) ** 2 + (g - gray) ** 2 + (b - gray) ** 2;
  return grayDist < cubeDist ? 232 + level : cube;
}

// Les 16 couleurs ANSI de base (xterm), pour le plus petit dénominateur commun.
const ANSI16 = [
  [0, 0, 0], [205, 0, 0], [0, 205, 0], [205, 205, 0],
  [0, 0, 238], [205, 0, 205], [0, 205, 205], [229, 229, 229],
  [127, 127, 127], [255, 0, 0], [0, 255, 0], [255, 255, 0],
  [92, 92, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
];

/** Teinte hex → index 0-15 (proche de la perception : le vert pèse plus que le bleu). */
export function toAnsi16(hex) {
  const [r, g, b] = toRgb(hex);
  let best = 0;
  let dist = Infinity;
  for (let i = 0; i < ANSI16.length; i += 1) {
    const [rr, gg, bb] = ANSI16[i];
    const d = (r - rr) ** 2 * 0.3 + (g - gg) ** 2 * 0.59 + (b - bb) ** 2 * 0.11;
    if (d < dist) {
      dist = d;
      best = i;
    }
  }
  return best;
}

/** Normalise un réglage écrit à la main (« 24bit », « on », « off »…). */
function normalizeMode(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return null;
  if (['truecolor', '24bit', '24', 'rgb', 'on', 'oui', 'yes', '1', 'always', 'toujours'].includes(v)) {
    return 'truecolor';
  }
  if (['256', 'ansi256', '8bit', 'xterm256'].includes(v)) return '256';
  if (['16', 'ansi', 'basic', 'simple', '4bit'].includes(v)) return '16';
  if (['none', 'off', 'no', 'non', '0', 'never', 'jamais'].includes(v)) return 'none';
  return null;
}

function detectColorMode() {
  const env = process.env;
  const forced = normalizeMode(env.XOZHUB_COLOR);
  if (forced) return forced;
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return 'none';
  if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '' && env.FORCE_COLOR !== '0') {
    return 'truecolor';
  }
  if (process.stdout.isTTY !== true) return 'none';
  const term = String(env.TERM || '').toLowerCase();
  if (term === 'dumb') return 'none';
  const colorterm = String(env.COLORTERM || '').toLowerCase();
  if (colorterm.includes('truecolor') || colorterm.includes('24bit')) return 'truecolor';
  // Windows Terminal, VS Code, iTerm… savent tous le 24 bits.
  if (env.WT_SESSION || env.TERM_PROGRAM) return 'truecolor';
  if (term.includes('256')) return '256';
  // Console Windows moderne (VT activé par Node) : le 24 bits passe.
  return 'truecolor';
}

let colorMode = detectColorMode();

/** Mode courant : 'truecolor' | '256' | '16' | 'none'. */
export function getColorMode() {
  return colorMode;
}

/**
 * Change le mode à chaud (commande /couleurs). Sans argument valable, on redétecte.
 * Renvoie le mode retenu.
 */
export function setColorMode(value) {
  colorMode = normalizeMode(value) || detectColorMode();
  colorsEnabled = colorMode !== 'none';
  return colorMode;
}

export let colorsEnabled = colorMode !== 'none';

export function fg(hex) {
  if (colorMode === 'none') return '';
  if (colorMode === '256') return `\x1b[38;5;${toAnsi256(hex)}m`;
  if (colorMode === '16') {
    const i = toAnsi16(hex);
    return `\x1b[${i < 8 ? 30 + i : 90 + (i - 8)}m`;
  }
  const [r, g, b] = toRgb(hex);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function bg(hex) {
  if (colorMode === 'none') return '';
  if (colorMode === '256') return `\x1b[48;5;${toAnsi256(hex)}m`;
  if (colorMode === '16') {
    const i = toAnsi16(hex);
    return `\x1b[${i < 8 ? 40 + i : 100 + (i - 8)}m`;
  }
  const [r, g, b] = toRgb(hex);
  return `\x1b[48;2;${r};${g};${b}m`;
}

/** Colorise du texte (truecolor, 256 ou 16 couleurs selon le terminal). */
export function c(hex, text, opts = {}) {
  const str = text === undefined || text === null ? '' : String(text);
  if (!colorsEnabled || str === '') return str;
  let codes = fg(hex);
  if (opts.bg) codes += bg(opts.bg);
  if (opts.bold) codes += '\x1b[1m';
  if (opts.dim) codes += '\x1b[2m';
  if (opts.italic) codes += '\x1b[3m';
  if (opts.underline) codes += '\x1b[4m';
  return codes + str + RESET;
}

/** Colorise avec un fond. */
export function cb(fgHex, bgHex, text, opts = {}) {
  return c(fgHex, text, { ...opts, bg: bgHex });
}

/**
 * Pose un fond continu sous une ligne déjà colorée : chaque remise à zéro du texte
 * est suivie du fond, sinon le premier code ANSI rencontré couperait la carte.
 */
export function withBg(bgHex, text) {
  const str = String(text ?? '');
  if (!colorsEnabled || !str) return str;
  const open = bg(bgHex);
  if (!open) return str;
  return open + str.split(RESET).join(RESET + open) + RESET;
}

const hex = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');

// --------------------------------------------------------------------- mélange perceptif
//
// Interpoler deux couleurs composante par composante en RGB donne un milieu terne :
// un dégradé bleu → jaune passe par un gris sale, un magenta → cyan par un violet boueux.
// L'œil ne voit pas le RGB, il voit la lumière. On interpole donc dans OKLab, l'espace
// uniforme de la perception : chaque étape d'un dégradé est une teinte juste, avec son
// éclat conservé. C'est la différence entre un dégradé qui « marche » et un dégradé qui
// brille — et ça ne coûte rien, c'est du calcul.

const srgbToLinear = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** sRGB (0-255) → OKLab { L, a, b }. */
export function toOklab(rgb) {
  const [r, g, b] = rgb.map((v) => srgbToLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → sRGB (0-255), ramené de force dans le gamut affichable. */
export function fromOklab({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((v) => Math.min(255, Math.max(0, linearToSrgb(v) * 255)));
}

/** Interpole deux teintes en OKLab : `t` = 0 → `a`, `t` = 1 → `b`. */
export function mix(a, b, t) {
  const k = Math.min(1, Math.max(0, Number(t) || 0));
  const A = toOklab(toRgb(a));
  const B = toOklab(toRgb(b));
  const [r, g, bl] = fromOklab({
    L: A.L + (B.L - A.L) * k,
    a: A.a + (B.a - A.a) * k,
    b: A.b + (B.b - A.b) * k,
  });
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
}

/** Luminance relative WCAG d'une teinte (0 = noir, 1 = blanc). */
export function luminance(hexColor) {
  const [r, g, b] = toRgb(hexColor).map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Rapport de contraste WCAG entre deux teintes.
 * 1 = identiques · 4.5 = lisible partout (le minimum d'un texte) · 7 = confortable.
 * C'est ce qui décide si une couleur est « belle » ou juste « jolie mais illisible ».
 */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Palette de `count` teintes régulières entre `from` et `to`. */
export function ramp(from, to, count) {
  const n = Math.max(2, count);
  const out = [];
  for (let i = 0; i < n; i += 1) out.push(mix(from, to, i / (n - 1)));
  return out;
}

export const ANSI_RE = /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07/g;

export function stripAnsi(s) {
  return String(s).replace(ANSI_RE, '');
}

/** Largeur visible (sans les codes ANSI). */
export function vlen(s) {
  return Array.from(stripAnsi(s)).length;
}

export function truncate(s, width) {
  const chars = Array.from(String(s));
  let out = '';
  let count = 0;
  let i = 0;
  while (i < chars.length) {
    if (chars[i] === '\x1b') {
      const m = /^\x1b\[[0-9;?]*[A-Za-z]/.exec(chars.slice(i).join(''));
      if (m) {
        out += m[0];
        i += Array.from(m[0]).length;
        continue;
      }
    }
    if (count >= width) break;
    out += chars[i];
    count += 1;
    i += 1;
  }
  return out;
}

export function padEnd(s, width) {
  const missing = width - vlen(s);
  return missing > 0 ? String(s) + ' '.repeat(missing) : String(s);
}

export function padStart(s, width) {
  const missing = width - vlen(s);
  return missing > 0 ? ' '.repeat(missing) + String(s) : String(s);
}

export function fit(s, width) {
  return padEnd(truncate(s, width), width);
}

// --------------------------------------------------------------------- palette

// Teintes de base : vives, mais accordées entre elles. Elles viennent toutes de la même famille
// (indigo → violet → magenta d'un côté, cyan → menthe de l'autre) : posées côte à côte, elles se
// répondent au lieu de se disputer l'œil. C'est ce qui donne une interface « propre » plutôt
// qu'une interface bariolée.
const INDIGO = '#6366F1';
const VIOLET = '#8B5CF6';
const PURPLE = '#A78BFA';
const BLUE = '#60A5FA';
const SKY = '#38BDF8';
const CYAN = '#22D3EE';
const TEAL = '#2DD4BF';
const MINT = '#34D399';
const LIME = '#A3E635';
const GOLD = '#FBBF24';
const AMBER = '#F59E0B';
const ORANGE = '#FB923C';
const CORAL = '#FB7185';
const PINK = '#F472B6';
const MAGENTA = '#E879F9';
const ROSE = '#FF5D8F';

export const theme = {
  // ------------------------------------------------------------------ dégradés
  // Chaque dégradé reste court (3 à 4 teintes) et suit un seul chemin dans le cercle
  // chromatique. Un dégradé qui traverse tout le spectre fait « arc-en-ciel » ; un dégradé
  // court et continu fait « produit fini ». C'est toute la différence à l'écran.
  //
  // Logo : la marque, indigo → violet → magenta → cyan (quatre stops, un seul arc).
  logoGradient: [INDIGO, VIOLET, MAGENTA, CYAN],
  // Filets de séparation : la partie froide de l'arc, en continu.
  ruleGradient: [VIOLET, BLUE, CYAN, TEAL],
  // Cadre du panneau de l'agent, du haut vers le bas : magenta → cyan.
  agentRail: [MAGENTA, VIOLET, BLUE, CYAN],
  // Rail des messages de l'utilisateur : famille CHAUDE, pour le distinguer de l'IA au premier regard.
  userRail: [GOLD, ORANGE, CORAL],
  // Cadre de la zone de saisie : cyan → menthe.
  frameGradient: [CYAN, TEAL, MINT],
  // Nom de l'agent et état de travail.
  aiGradient: [MAGENTA, VIOLET, BLUE, CYAN],
  // Bandeaux-titres (mise à jour en cours / validée / incomplète).
  bannerLive: [VIOLET, MAGENTA],
  bannerOk: [MINT, LIME],
  bannerWarn: [GOLD, ORANGE],
  // La spirale glisse dans tout le spectre : vivante, jamais deux fois la même teinte d'affilée.
  spinnerGradient: [
    MAGENTA, VIOLET, BLUE, SKY, CYAN, TEAL, MINT, LIME, MINT, TEAL, CYAN, SKY, BLUE, VIOLET,
  ],
  // Bandeau-titre du panneau de l'IA : la marque en dégradé.
  brandGradient: [VIOLET, MAGENTA, CYAN],

  // ------------------------------------------------------------------ encres
  // Encres : le texte reste lisible sur un fond nuit, donc on ne descend jamais trop bas.
  // Les tons « discrets » gardent assez de clarté pour se lire sans plisser les yeux —
  // un texte gris trop sombre, c'est la première chose qui fait « bâclé ».
  text: '#EEF2FF',
  bright: '#FFFFFF',
  // « accent » sert de couleur de TEXTE (citations, repères) : c'est donc le violet clair,
  // pas celui des dégradés — à 4.4:1 le foncé tombait juste sous le seuil de lisibilité.
  accent: PURPLE, // violet clair : identité de l'agent, lisible sur le fond
  accent2: CYAN, // cyan : l'utilisateur, les commandes
  muted: '#B8C2EC',
  faint: '#7E8AC0',
  hint: '#9AA6DC',

  // Teintes vives : accents, titres, badges.
  vivid: {
    pink: MAGENTA,
    rose: ROSE,
    violet: PURPLE,
    purple: PURPLE,
    indigo: INDIGO,
    blue: SKY,
    sky: SKY,
    cyan: CYAN,
    ice: '#9BE8FF',
    teal: TEAL,
    mint: MINT,
    lime: LIME,
    gold: GOLD,
    amber: GOLD,
    orange: ORANGE,
    coral: CORAL,
  },

  // ------------------------------------------------------------------ cadres
  border: '#6159D6',
  borderSoft: '#403A82',
  railDim: '#3A3572',
  // Fond des cartes (panneau de l'IA, zone de saisie) : un indigo très sombre, teinté —
  // ni noir pur (qui aplatit), ni gris (qui éteint les couleurs posées dessus).
  panelBg: '#120F2A',
  panelBgSoft: '#1E1A4C',

  // ------------------------------------------------------------------ états
  cmd: '#5EEAD4',
  cmdBg: '#0B3B36',
  ok: MINT,
  warn: GOLD,
  err: CORAL,
  errBg: '#5A1030',
  errFg: '#FFD9E4',
  okBg: '#0C4433',
  // Bloc de code : un fond légèrement plus clair que le panneau, pour que le code se
  // détache en bande au lieu de flotter au milieu du texte.
  codeBg: '#1B1747',
  codeFg: '#9BFFE6',

  // ------------------------------------------------------------------ boutons
  // Les deux pastilles cliquables de l'interface. Leurs fonds sont choisis pour que
  // l'encre posée dessus passe le seuil de lisibilité sur TOUTE la longueur du dégradé —
  // un bouton dont la fin du mot devient illisible est un bouton raté.
  stopGradient: ['#9F1239', '#BE123C'], // STOP : cramoisi profond, encre blanche
  stopInk: '#FFFFFF',
  endGradient: [VIOLET, PINK], // End session : violet → rose, encre sombre

  // ------------------------------------------------------------------ badges
  // Texte sombre posé sur un fond vif : le badge ressort sans crier.
  onWarm: '#2A1400', // sur ambre / or
  onCool: '#140029', // sur violet / magenta
  onMint: '#04231B', // sur menthe / lime
  onCoral: '#3A0016', // sur corail / rose

  // ------------------------------------------------------------------ barre
  barBg: '#1C1846',
  barTop: '#5346D8',
  barDeep: '#131C3E',
  barDark: '#0D0B20',
  barFg: '#F1F4FF',
  chip: '#3A2F8C',
  chipSoft: '#241F52',
  chipUser: '#6B3A0A',
  chipCmd: '#0F3F38',
  chipAccent: MAGENTA,
  chipAccentDeep: '#7A1B63',
};
