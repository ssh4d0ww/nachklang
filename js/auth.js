// Login bei Spotify mit "Authorization Code + PKCE".
// Kein Server nötig: Der geheime Schlüssel bleibt weg, stattdessen
// beweist ein zufälliger "code_verifier", dass die Anfrage von uns kommt.
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

// Berechtigungen aus CONFIG.scopes, die der aktuelle Login noch nicht hat
// (z. B. nach einem Update, das neue Funktionen braucht)
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
    // Spotify schickt beim Erneuern nicht immer einen neuen refresh_token
    refresh: data.refresh_token || previous?.refresh || null,
    expires: Date.now() + (data.expires_in - 60) * 1000,
    // welche Berechtigungen der Login wirklich erteilt hat
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
  if (!clientId) throw new AuthError("Es fehlt noch die Spotify Client ID.");
  if (!window.isSecureContext) throw new AuthError("Login geht nur über https:// oder http://127.0.0.1.");
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

// Nach dem Login schickt Spotify uns mit ?code=... zurück.
// Gibt true zurück, wenn gerade ein Login abgeschlossen wurde.
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has("code") && !params.has("error")) return false;

  // Adresse aufräumen, damit ein Neuladen den Code nicht nochmal schickt
  history.replaceState(null, "", CONFIG.redirectUri);

  if (params.has("error")) {
    const err = params.get("error");
    throw new AuthError(err === "access_denied" ? "Login abgebrochen." : `Spotify meldet: ${err}`);
  }
  const verifier = store.get(KEYS.verifier);
  if (!verifier || params.get("state") !== store.get(KEYS.state)) {
    throw new AuthError("Login konnte nicht geprüft werden. Bitte nochmal versuchen.");
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
  if (!current?.refresh) throw new AuthError("Bitte neu mit Spotify verbinden.");
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
    // Netzwerk/Serverfehler: Token behalten, später nochmal probieren
    if (res.status >= 500) throw new Error("Spotify ist gerade nicht erreichbar.");
    logout();
    throw new AuthError("Bitte neu mit Spotify verbinden.");
  }
  return saveToken(await res.json(), current);
}

// Liefert ein gültiges Access Token und erneuert es bei Bedarf.
// force = true: auch erneuern, wenn es noch gültig aussieht (z. B. nach 401)
export async function getAccessToken(force = false) {
  const token = readToken();
  if (!token) throw new AuthError("Nicht verbunden.");
  if (!force && Date.now() < token.expires) return token.access;
  // mehrere gleichzeitige Anfragen teilen sich eine Erneuerung
  refreshing ??= refresh().finally(() => (refreshing = null));
  return (await refreshing).access;
}

async function describeTokenError(res) {
  try {
    const body = await res.json();
    if (body.error === "invalid_client") return "Client ID stimmt nicht. Bitte im Spotify Dashboard prüfen.";
    if (body.error === "invalid_grant") return "Redirect URI passt nicht oder der Code ist abgelaufen.";
    return body.error_description || body.error || `Fehler ${res.status}`;
  } catch {
    return `Fehler ${res.status}`;
  }
}
