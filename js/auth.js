// Spotify login using "Authorization Code + PKCE".
// No server needed: there is no client secret; instead a random
// "code_verifier" proves that the request came from us.
import { CONFIG } from "./config.js";
import { store } from "./store.js";

const KEYS = {
  token: "nk.token",
  verifier: "nk.verifier",
  state: "nk.state",
  clientId: "nk.clientId",
};

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export class AuthError extends Error {}

export function getClientId() {
  return (CONFIG.clientId || store.get(KEYS.clientId) || "").trim();
}

export function setClientId(id) {
  store.set(KEYS.clientId, id.trim());
}

export function isLoggedIn() {
  return !!readToken();
}

// scopes from CONFIG.scopes that the current login does not have yet
// (e.g. after an update that needs new permissions)
export function missingScopes(wanted = CONFIG.scopes) {
  const granted = new Set((readToken()?.scope || "").split(/\s+/).filter(Boolean));
  return wanted.filter((s) => !granted.has(s));
}

export function logout() {
  store.remove(KEYS.token);
}

function readToken() {
  try {
    return JSON.parse(store.get(KEYS.token) || "null");
  } catch {
    return null;
  }
}

function saveToken(data, previous) {
  const token = {
    access: data.access_token,
    // Spotify does not always send a new refresh_token when refreshing
    refresh: data.refresh_token || previous?.refresh || null,
    expires: Date.now() + (data.expires_in - 60) * 1000,
    // which scopes the login actually granted
    scope: data.scope || previous?.scope || "",
  };
  store.set(KEYS.token, JSON.stringify(token));
  return token;
}

function base64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

export async function buildLoginUrl() {
  const clientId = getClientId();
  if (!clientId) throw new AuthError("The Spotify Client ID is missing.");
  if (!window.isSecureContext) throw new AuthError("Login only works over https:// or http://127.0.0.1.");
  const verifier = randomString(64);
  const state = randomString(16);
  store.set(KEYS.verifier, verifier);
  store.set(KEYS.state, state);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: CONFIG.redirectUri,
    scope: CONFIG.scopes.join(" "),
    code_challenge_method: "S256",
    code_challenge: base64url(await sha256(verifier)),
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export async function login() {
  location.assign(await buildLoginUrl());
}

// After login Spotify sends us back with ?code=...
// Returns true if a login was just completed.
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has("code") && !params.has("error")) return false;

  // clean up the URL so a reload does not send the code again
  history.replaceState(null, "", CONFIG.redirectUri);

  if (params.has("error")) {
    const err = params.get("error");
    throw new AuthError(err === "access_denied" ? "Login cancelled." : `Spotify says: ${err}`);
  }
  const verifier = store.get(KEYS.verifier);
  if (!verifier || params.get("state") !== store.get(KEYS.state)) {
    throw new AuthError("Login could not be verified. Please try again.");
  }
  store.remove(KEYS.verifier);
  store.remove(KEYS.state);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.get("code"),
      redirect_uri: CONFIG.redirectUri,
      client_id: getClientId(),
      code_verifier: verifier,
    }),
  });
  if (!res.ok) throw new AuthError(await describeTokenError(res));
  saveToken(await res.json());
  return true;
}

let refreshing = null;

async function refresh() {
  const current = readToken();
  if (!current?.refresh) throw new AuthError("Please reconnect to Spotify.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: current.refresh,
      client_id: getClientId(),
    }),
  });
  if (!res.ok) {
    // network/server error: keep the token, try again later
    if (res.status >= 500) throw new Error("Spotify is not reachable right now.");
    logout();
    throw new AuthError("Please reconnect to Spotify.");
  }
  return saveToken(await res.json(), current);
}

// Returns a valid access token and refreshes it when needed.
// force = true: refresh even if it still looks valid (e.g. after a 401)
export async function getAccessToken(force = false) {
  const token = readToken();
  if (!token) throw new AuthError("Nicht verbunden.");
  if (!force && Date.now() < token.expires) return token.access;
  // concurrent requests share a single refresh
  refreshing ??= refresh().finally(() => (refreshing = null));
  return (await refreshing).access;
}

async function describeTokenError(res) {
  try {
    const body = await res.json();
    if (body.error === "invalid_client") return "Invalid Client ID. Please check it in the Spotify Dashboard.";
    if (body.error === "invalid_grant") return "Redirect URI does not match or the code has expired.";
    return body.error_description || body.error || `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}
