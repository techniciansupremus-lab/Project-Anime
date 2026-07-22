const CONFIG_STORAGE_KEY = 'eetnet_api_base';

function cleanApiBase(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

function getLocalDevBase() {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') {
    return `${window.location.protocol}//${host}:8080`;
  }
  return '';
}

/** Returns true if this URL is a localhost URL that should not run on production Vercel */
function isStaleDevUrl(url) {
  if (!url) return false;
  return (
    url.includes('localhost') ||
    url.includes('127.0.0.1')
  );
}

/** On Vercel production, wipe any stale localhost override from all caches */
function purgeStaleOverridesIfNeeded() {
  if (typeof window === 'undefined') return;
  if (!window.location.hostname.endsWith('.vercel.app')) return;

  try {
    const stored = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (isStaleDevUrl(stored)) {
      window.localStorage.removeItem(CONFIG_STORAGE_KEY);
    }
  } catch (_) {}

  // Also wipe from in-memory config if it's localhost
  if (window.__EETNET_CONFIG__ && isStaleDevUrl(window.__EETNET_CONFIG__.API_BASE)) {
    window.__EETNET_CONFIG__.API_BASE = '';
  }
}

function readQueryOverride() {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  const value = cleanApiBase(url.searchParams.get('apiBase'));
  if (!value) return '';

  try {
    window.localStorage.setItem(CONFIG_STORAGE_KEY, value);
  } catch (err) {
    console.warn('[Config] Could not persist apiBase override', err);
  }

  url.searchParams.delete('apiBase');
  window.history.replaceState({}, '', url.toString());
  return value;
}

function readStoredOverride() {
  if (typeof window === 'undefined') return '';
  try {
    const val = cleanApiBase(window.localStorage.getItem(CONFIG_STORAGE_KEY));
    if (val && window.location.hostname.endsWith('.vercel.app')) {
      if (isStaleDevUrl(val)) {
        window.localStorage.removeItem(CONFIG_STORAGE_KEY);
        return '';
      }
    }
    return val;
  } catch {
    return '';
  }
}

async function readJsonConfig(url) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  }
}

function pickApiBase(config) {
  return cleanApiBase(
    config?.API_BASE ||
    config?.apiBase ||
    config?.VITE_API_BASE ||
    ''
  );
}

export async function loadRuntimeConfig() {
  purgeStaleOverridesIfNeeded();

  const queryOverride = readQueryOverride();
  const storedOverride = readStoredOverride();
  const runtimeEndpoint = await readJsonConfig('/api/runtime-config');
  const staticConfig = await readJsonConfig('/eetnet-config.json');
  
  let envBase = cleanApiBase(import.meta.env.VITE_API_BASE);
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app') && isStaleDevUrl(envBase)) {
    envBase = '';
  }

  const localDevBase = getLocalDevBase();

  const apiBase =
    queryOverride ||
    storedOverride ||
    pickApiBase(runtimeEndpoint) ||
    pickApiBase(staticConfig) ||
    envBase ||
    localDevBase;

  window.__EETNET_CONFIG__ = {
    ...(window.__EETNET_CONFIG__ || {}),
    API_BASE: cleanApiBase(apiBase),
  };

  return window.__EETNET_CONFIG__;
}

export function getApiBase() {
  purgeStaleOverridesIfNeeded();

  const runtimeBase = cleanApiBase(window.__EETNET_CONFIG__?.API_BASE);
  const storedBase = readStoredOverride();
  
  let envBase = cleanApiBase(import.meta.env.VITE_API_BASE);
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app') && isStaleDevUrl(envBase)) {
    envBase = '';
  }

  const onVercel = typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app');
  const safeRuntimeBase = (onVercel && isStaleDevUrl(runtimeBase)) ? '' : runtimeBase;
  const safeStoredBase  = (onVercel && isStaleDevUrl(storedBase))  ? '' : storedBase;

  return safeRuntimeBase || safeStoredBase || envBase || getLocalDevBase();
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function getBackendConfigError() {
  // On Vercel, relative /api paths target Vercel Serverless Functions natively, so empty API_BASE is completely valid.
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.vercel.app')) {
    return '';
  }
  if (getApiBase()) return '';
  return '';
}
