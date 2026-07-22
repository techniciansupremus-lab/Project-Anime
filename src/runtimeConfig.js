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
    return cleanApiBase(window.localStorage.getItem(CONFIG_STORAGE_KEY));
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
  const queryOverride = readQueryOverride();
  const storedOverride = readStoredOverride();
  const runtimeEndpoint = await readJsonConfig('/api/runtime-config');
  const staticConfig = await readJsonConfig('/eetnet-config.json');
  const envBase = cleanApiBase(import.meta.env.VITE_API_BASE);
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
  const runtimeBase = cleanApiBase(window.__EETNET_CONFIG__?.API_BASE);
  const storedBase = readStoredOverride();
  const envBase = cleanApiBase(import.meta.env.VITE_API_BASE);
  return runtimeBase || storedBase || envBase || getLocalDevBase();
}

export function apiUrl(path) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBase();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

export function getBackendConfigError() {
  return '';
}
