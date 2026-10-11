/**
 * Durable, namespaced localStorage helpers.
 * Every mutation is defensive — a corrupted payload must never white-screen the app.
 */

const PREFIX = 'capex-studio';

export const STORAGE_KEYS = {
  PROGRESS: `${PREFIX}:progress:v1`,
  BUDGET: `${PREFIX}:budget:v1`,
  SESSION: `${PREFIX}:session:v1`,
  SETTINGS: `${PREFIX}:settings:v1`,
};

export function loadState(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return structuredClone(fallback);
    const parsed = JSON.parse(raw);
    if (parsed == null) return structuredClone(fallback);
    return { ...structuredClone(fallback), ...parsed };
  } catch {
    return structuredClone(fallback);
  }
}

export function saveState(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearState(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* storage disabled — nothing to do */
  }
}

export function clearAllState() {
  Object.values(STORAGE_KEYS).forEach(clearState);
}
