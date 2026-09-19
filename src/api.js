// XozHub.GPT — client de l'API X.GPT (compatible OpenAI).

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const clean = (baseUrl) => String(baseUrl || '').replace(/\/+$/, '');

function headers(cfg, withJson = false) {
  const h = { authorization: `Bearer ${cfg.apiKey}` };
  if (withJson) h['content-type'] = 'application/json';
  return h;
}

/** GET /v1/models — renvoie la liste des identifiants de modèles. */
export async function listModels(cfg, { signal } = {}) {
  const res = await fetch(`${clean(cfg.baseUrl)}/models`, {
    headers: headers(cfg),
    signal,
  });
  const body = await res.text();
  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status} sur /models`, res.status, body);
  }
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    throw new ApiError('Réponse /models illisible', res.status, body);
  }
  const list = json.data || json.models || json;
  if (!Array.isArray(list)) return [];
  return list
    .map((m) => (typeof m === 'string' ? m : m && (m.id || m.name || m.model)))
    .filter(Boolean);
}

/**
 * Découpe un identifiant de modèle en { provider, family, nums, variant } :
 * « agentrouter/deepseek-v4.1-flash » ->
 * { provider: 'agentrouter', family: 'deepseek', nums: [4, 1], variant: 'flash' }.
 * `nums` vaut null quand aucun numéro de version n'est lisible (rien à comparer).
 */
export function describeModel(id) {
  const raw = String(id || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  const slash = raw.lastIndexOf('/');
  const provider = slash === -1 ? '' : raw.slice(0, slash);
  const parts = raw
    .slice(slash + 1)
    .split(/[\-_\s]+/)
    .filter(Boolean);
  if (!parts.length) return null;
  const family = [];
  let nums = null;
  let i = 0;
  for (; i < parts.length; i += 1) {
    const found = /^v?(\d+(?:\.\d+)*)$/.exec(parts[i]);
    if (found) {
      nums = found[1].split('.').map(Number);
      break;
    }
    family.push(parts[i]);
  }
  const variant = parts.slice(i + 1).join('-');
  return { provider, family: family.join('-') || parts[0], nums, variant };
}

/** Compare deux numéros de version (« v4.1 » > « v4 »). */
function compareVersions(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

/**
 * Choisit la version la plus récente de la même famille que `current`
 * (« …/deepseek-v4-flash » -> « …/deepseek-v5-flash »). Renvoie null quand le
 * modèle courant est déjà le plus récent, ou quand rien n'est comparable.
 *
 * À version égale, on garde la variante courante (« flash » reste « flash »).
 * Même famille chez un autre fournisseur : acceptée seulement si le fournisseur
 * habituel n'a rien de plus récent (le catalogue peut renommer le préfixe).
 * Si le modèle courant a disparu de la liste, on prend le plus récent de sa famille.
 */
export function pickLatestModel(models, current) {
  const list = (models || []).map((m) => String(m || '').trim()).filter(Boolean);
  const cur = describeModel(current);
  if (!list.length || !cur || !cur.nums) return null;

  const entries = list
    .map((id) => ({ id, model: describeModel(id) }))
    .filter((e) => e.model && e.model.nums);
  const score = (m) => (m.variant && m.variant === cur.variant ? 1 : 0);

  const scan = (sameFamily) => {
    let best = null;
    let newest = null;
    for (const e of entries) {
      if (!sameFamily(e.model)) continue;
      if (!newest || compareVersions(e.model.nums, newest.model.nums) > 0) newest = e;
      if (compareVersions(e.model.nums, cur.nums) <= 0) continue;
      const better = !best || compareVersions(e.model.nums, best.model.nums) > 0;
      const tie =
        best && compareVersions(e.model.nums, best.model.nums) === 0 && score(e.model) > score(best.model);
      if (better || tie) best = e;
    }
    return { best, newest };
  };

  const strict = scan((m) => m.family === cur.family && m.provider === cur.provider);
  if (strict.best) return strict.best.id;
  const relaxed = scan((m) => m.family === cur.family);
  if (relaxed.best) return relaxed.best.id;

  // Rien de plus récent : si le modèle configuré n'existe plus, on reste dans la famille.
  if (list.includes(String(current).trim())) return null;
  return (strict.newest || relaxed.newest)?.id ?? null;
}

/**
 * POST /v1/chat/completions en streaming.
 * `onDelta(texte)` est appelé à chaque morceau reçu.
 * Renvoie le texte complet de la réponse.
 */
export async function streamChat(cfg, messages, { onDelta, signal, temperature } = {}) {
  const payload = { model: cfg.model, messages, stream: true };
  // Température basse par défaut : l'agent reste sur le sujet au lieu de divaguer.
  const temp = temperature === undefined ? cfg.temperature : temperature;
  if (typeof temp === 'number' && Number.isFinite(temp)) payload.temperature = temp;

  const send = (body) =>
    fetch(`${clean(cfg.baseUrl)}/chat/completions`, {
      method: 'POST',
      headers: headers(cfg, true),
      body: JSON.stringify(body),
      signal,
    });

  let res = await send(payload);
  if (res.status === 400 && payload.temperature !== undefined) {
    // Certains serveurs refusent « temperature » : on réessaie sans, plutôt que d'échouer.
    const peek = await res
      .clone()
      .text()
      .catch(() => '');
    if (/temperature/i.test(peek)) {
      const retry = { ...payload };
      delete retry.temperature;
      res = await send(retry);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let detail = body;
    try {
      const json = JSON.parse(body);
      detail = json.error?.message || json.message || body;
    } catch {
      /* body brut */
    }
    throw new ApiError(
      `HTTP ${res.status} sur /chat/completions${detail ? ` — ${String(detail).slice(0, 400)}` : ''}`,
      res.status,
      body,
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('event-stream')) {
    // Certains serveurs ignorent `stream: true` : on retombe sur une réponse complète.
    const body = await res.text();
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      throw new ApiError('Réponse illisible du serveur', res.status, body);
    }
    if (json.error) throw new ApiError(json.error.message || 'Erreur renvoyée par l’API', res.status, body);
    const text = json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text ?? '';
    if (text && onDelta) onDelta(text);
    return text;
  }

  if (!res.body) throw new ApiError('Le serveur n’a pas renvoyé de flux (stream non supporté ?)', res.status, '');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return full;
      let json;
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }
      if (json.error) throw new ApiError(json.error.message || 'Erreur renvoyée par l’API', 200, payload);
      const choice = json.choices?.[0];
      const delta = choice?.delta || choice?.message || {};
      const text = typeof delta.content === 'string' ? delta.content : '';
      if (text) {
        full += text;
        if (onDelta) onDelta(text);
      }
    }
  }

  return full;
}
