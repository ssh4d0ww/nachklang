// Dünne Hülle um die Spotify Web API (nur die Teile, die Nachklang braucht).
// Steuer-Befehle (Play, Pause, Skip ...) brauchen Spotify Premium.
import { getAccessToken, AuthError } from "./auth.js";

const BASE = "https://api.spotify.com/v1";

export class ApiError extends Error {
  constructor(status, message, reason, retryAfter) {
    super(message);
    this.status = status;
    this.reason = reason;
    this.retryAfter = retryAfter;
  }
}

async function request(method, path, { query, body } = {}, retried = false) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
  }
  const token = await getAccessToken(retried);
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Keine Verbindung zu Spotify.");
  }

  if (res.status === 401 && !retried) return request(method, path, { query, body }, true);
  if (res.status === 401) throw new AuthError("Bitte neu mit Spotify verbinden.");
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After")) || 5;
    throw new ApiError(429, "Zu viele Anfragen – kurz Pause.", "RATE_LIMIT", wait);
  }
  if (res.status === 204 || res.status === 202) return null;

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const reason = data?.error?.reason;
    throw new ApiError(res.status, friendlyMessage(res.status, reason, data?.error?.message), reason);
  }
  return data;
}

function friendlyMessage(status, reason, fallback) {
  if (reason === "NO_ACTIVE_DEVICE" || status === 404) return "Kein aktives Gerät. Wähl eins aus.";
  if (reason === "PREMIUM_REQUIRED") return "Dafür braucht es Spotify Premium.";
  if (reason === "VOLUME_CONTROL_DISALLOW") return "Dieses Gerät erlaubt keine Lautstärke von außen.";
  if (status === 403) return "Das geht auf diesem Gerät gerade nicht.";
  return fallback || `Spotify-Fehler ${status}`;
}

const uriList = (uris) => (Array.isArray(uris) ? uris : [uris]).join(",");

export function createSpotifyApi() {
  return {
    kind: "spotify",
    me: () => request("GET", "/me"),
    playbackState: () => request("GET", "/me/player", { query: { additional_types: "episode" } }),
    play: (deviceId, body) => request("PUT", "/me/player/play", { query: { device_id: deviceId }, body }),
    pause: (deviceId) => request("PUT", "/me/player/pause", { query: { device_id: deviceId } }),
    next: (deviceId) => request("POST", "/me/player/next", { query: { device_id: deviceId } }),
    previous: (deviceId) => request("POST", "/me/player/previous", { query: { device_id: deviceId } }),
    seek: (ms, deviceId) => request("PUT", "/me/player/seek", { query: { position_ms: Math.round(ms), device_id: deviceId } }),
    shuffle: (on, deviceId) => request("PUT", "/me/player/shuffle", { query: { state: on, device_id: deviceId } }),
    repeat: (mode, deviceId) => request("PUT", "/me/player/repeat", { query: { state: mode, device_id: deviceId } }),
    volume: (pct, deviceId) => request("PUT", "/me/player/volume", { query: { volume_percent: Math.round(pct), device_id: deviceId } }),
    devices: () => request("GET", "/me/player/devices"),
    transfer: (deviceId, play) => request("PUT", "/me/player", { body: { device_ids: [deviceId], play } }),
    queue: () => request("GET", "/me/player/queue"),
    recent: () => request("GET", "/me/player/recently-played", { query: { limit: 30 } }),
    addToQueue: (uri, deviceId) => request("POST", "/me/player/queue", { query: { uri, device_id: deviceId } }),

    // Bibliothek
    myPlaylists: (offset = 0) => request("GET", "/me/playlists", { query: { limit: 50, offset } }),
    // seit Februar 2026 heißt der Endpunkt /items (früher /tracks) und liefert
    // den Inhalt nur noch für eigene Playlists
    playlistItems: (id, offset = 0) => request("GET", `/playlists/${id}/items`, { query: { limit: 50, offset, additional_types: "track,episode" } }),
    savedTracks: (offset = 0) => request("GET", "/me/tracks", { query: { limit: 50, offset } }),
    savedAlbums: (offset = 0) => request("GET", "/me/albums", { query: { limit: 50, offset } }),
    album: (id) => request("GET", `/albums/${id}`),
    albumTracks: (id, offset = 0) => request("GET", `/albums/${id}/tracks`, { query: { limit: 50, offset } }),
    artist: (id) => request("GET", `/artists/${id}`),
    artistAlbums: (id) => request("GET", `/artists/${id}/albums`, { query: { include_groups: "album,single", limit: 20 } }),
    // seit Februar 2026: höchstens 10 Treffer pro Typ
    search: (q) => request("GET", "/search", { query: { q, type: "track,artist,album,playlist", limit: 10 } }),

    // seit Februar 2026: Bibliothek über Spotify-URIs
    isSaved: (uris) => request("GET", "/me/library/contains", { query: { uris: uriList(uris) } }),
    save: (uris) => request("PUT", "/me/library", { query: { uris: uriList(uris) } }),
    unsave: (uris) => request("DELETE", "/me/library", { query: { uris: uriList(uris) } }),
  };
}
