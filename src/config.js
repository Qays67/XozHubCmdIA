// XozHub.GPT — configuration (clé API, URL de base, modèle).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEFAULTS = {
  baseUrl: 'https://xgpt-api.xshe.workers.dev/v1',
  // Modèle par défaut : le meilleur du compte pour écrire du vrai code (sites, applis, scripts).
  model: 'xgpt-code',
  // Mode automatique : les commandes proposées par l'agent s'exécutent sans confirmation.
  autoRun: true,
  // Température d'échantillonnage : basse, pour un agent concentré sur la demande.
  temperature: 0.2,
  // Palette de couleurs de l'interface : voir PALETTES dans theme.js.
  palette: 'galaxie',
};

// Ordre de préférence : le premier de cette liste qui existe sur le compte est choisi.
// Sert à deux choses : remplacer un modèle configuré qui n'existe plus, et faire monter un
// ancien modèle « passe-partout » (xgpt-glm / xgpt-mini / xgpt-flash) vers un modèle de dev.
export const MODEL_PREFERENCES = [
  'xgpt-code',
  'xgpt-smart',
  'xgpt-deepseek',
  'xgpt-sol',
  'xgpt-kimi',
  'xgpt-glm',
  'xgpt-flash',
  'xgpt-mini',
];

// Modèles « passe-partout » : bons à rien de précis. Si le compte propose mieux, on monte.
export const STARTER_MODELS = new Set(['xgpt-glm', 'xgpt-mini', 'xgpt-flash']);

/** Meilleur modèle disponible sur le compte, dans l'ordre de préférence (null si aucun). */
export function preferredModel(models) {
  const list = (models || []).map((m) => String(m || '').trim()).filter(Boolean);
  for (const want of MODEL_PREFERENCES) {
    const found = list.find((m) => {
      const low = m.toLowerCase();
      return low === want || low.endsWith(`/${want}`);
    });
    if (found) return found;
  }
  return null;
}

/**
 * Faut-il monter de modèle ? Oui quand le modèle courant est un ancien modèle
 * « passe-partout » et que le compte en propose un meilleur. Renvoie null sinon.
 */
export function upgradeModel(models, current) {
  const cur = String(current || '').trim().toLowerCase();
  if (!STARTER_MODELS.has(cur)) return null;
  const best = preferredModel(models);
  if (!best || best.toLowerCase() === cur) return null;
  if (STARTER_MODELS.has(best.toLowerCase())) return null;
  return best;
}

/** Accepte true/false, oui/non, on/off, 1/0 (insensible à la casse). */
function parseBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (value === undefined || value === null || value === '') return fallback;
  const v = String(value).trim().toLowerCase();
  if (['1', 'true', 'oui', 'on', 'yes', 'y', 'o'].includes(v)) return true;
  if (['0', 'false', 'non', 'off', 'no', 'n'].includes(v)) return false;
  return fallback;
}

/**
 * Température : 0.2 par défaut. « off » / « none » -> null (paramètre non envoyé).
 */
function parseTemperature(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return fallback;
  if (['off', 'none', 'false', 'non', 'no'].includes(raw)) return null;
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

const BRANDS = {
  agentrouter: 'AgentRouter',
  deepseek: 'DeepSeek',
  gpt: 'GPT',
  xgpt: 'XGPT',
  glm: 'GLM',
  ai: 'AI',
  api: 'API',
  qwen: 'Qwen',
  llama: 'Llama',
  mistral: 'Mistral',
  gemini: 'Gemini',
  grok: 'Grok',
  claude: 'Claude',
  kimi: 'Kimi',
  minimax: 'MiniMax',
  sonnet: 'Sonnet',
  opus: 'Opus',
  haiku: 'Haiku',
  flash: 'Flash',
  pro: 'Pro',
  plus: 'Plus',
  turbo: 'Turbo',
  mini: 'Mini',
  nano: 'Nano',
  lite: 'Lite',
};

/** « agentrouter/deepseek-v4-flash » -> « AgentRouter DeepSeek V4 Flash » */
export function labelFor(id) {
  const words = String(id || '')
    .split(/[-_/\s]+/)
    .filter(Boolean);
  if (!words.length) return 'Modèle inconnu';
  return words
    .map((w) => {
      const lower = w.toLowerCase();
      if (BRANDS[lower]) return BRANDS[lower];
      if (/^v?\d/.test(lower)) return lower.toUpperCase();
      if (lower.length <= 3) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

export function parseDotEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return {};
  }
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice(7).trim();
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) out[key] = value;
  }
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

export function configPath() {
  return path.join(process.cwd(), '.xozhub.json');
}

/** Fusionne .env / .xozhub.json (dossier courant prioritaire) et l'environnement. */
export function loadConfig() {
  const envDirs = [process.cwd(), PACKAGE_ROOT];
  const fileEnv = {};
  for (const dir of envDirs.reverse()) Object.assign(fileEnv, parseDotEnv(path.join(dir, '.env')));
  // le dossier courant est appliqué en dernier
  Object.assign(fileEnv, parseDotEnv(path.join(process.cwd(), '.env')));

  const fileCfg = {
    ...readJson(path.join(PACKAGE_ROOT, '.xozhub.json')),
    ...readJson(configPath()),
  };

  const apiKey =
    process.env.XOZHUB_API_KEY ||
    process.env.XGPT_API_KEY ||
    fileEnv.XOZHUB_API_KEY ||
    fileEnv.XGPT_API_KEY ||
    fileEnv.OPENAI_API_KEY ||
    fileCfg.apiKey ||
    '';

  const baseUrl =
    process.env.XOZHUB_BASE_URL || fileEnv.XOZHUB_BASE_URL || fileCfg.baseUrl || DEFAULTS.baseUrl;

  const model = process.env.XOZHUB_MODEL || fileEnv.XOZHUB_MODEL || fileCfg.model || DEFAULTS.model;

  const autoRun = parseBool(
    process.env.XOZHUB_AUTO ?? fileEnv.XOZHUB_AUTO ?? fileCfg.autoRun,
    DEFAULTS.autoRun,
  );

  const temperature = parseTemperature(
    process.env.XOZHUB_TEMPERATURE ?? fileEnv.XOZHUB_TEMPERATURE ?? fileCfg.temperature,
    DEFAULTS.temperature,
  );

  // Palette de couleurs choisie dans le panneau « ⚙ Paramètres » de l'interface.
  const palette =
    process.env.XOZHUB_PALETTE || fileEnv.XOZHUB_PALETTE || fileCfg.palette || DEFAULTS.palette;

  return { apiKey, baseUrl, model, autoRun, temperature, palette };
}

/** Enregistre un réglage dans .xozhub.json (dossier courant). */
export function saveConfig(patch) {
  try {
    const current = readJson(configPath());
    fs.writeFileSync(configPath(), `${JSON.stringify({ ...current, ...patch }, null, 2)}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}
