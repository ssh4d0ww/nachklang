// Thin wrapper around the Spotify Web API (only the parts Nachklang needs).
// Playback commands (play, pause, skip ...) require Spotify Premium.
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
    throw new ApiError(0, "No connection to Spotify.");
  }

  if (res.status === 401 && !retried) return request(method, path, { query, body }, true);
  if (res.status === 401) throw new AuthError("Please reconnect to Spotify.");
  if (res.status === 429) {
    const wait = Number(res.headers.get("Retry-After")) || 5;
    throw new ApiError(429, "Too many requests, pausing briefly.", "RATE_LIMIT", wait);
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
  if (reason === "NO_ACTIVE_DEVICE" || status === 404) return "No active device. Pick one.";
  if (reason === "PREMIUM_REQUIRED") return "This requires Spotify Premium.";
  if (reason === "VOLUME_CONTROL_DISALLOW") return "This device does not allow remote volume control.";
  if (status === 403) return "That is not possible on this device right now.";
  return fallback || `Spotify error ${status}`;
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

    // Library
    myPlaylists: (offset = 0) => request("GET", "/me/playlists", { query: { limit: 50, offset } }),
    // since February 2026 the endpoint is /items (formerly /tracks) and only
    // returns contents for playlists you own
    playlistItems: (id, offset = 0) => request("GET", `/playlists/${id}/items`, { query: { limit: 50, offset, additional_types: "track,episode" } }),
    savedTracks: (offset = 0) => request("GET", "/me/tracks", { query: { limit: 50, offset } }),
    savedAlbums: (offset = 0) => request("GET", "/me/albums", { query: { limit: 50, offset } }),
    album: (id) => request("GET", `/albums/${id}`),
    albumTracks: (id, offset = 0) => request("GET", `/albums/${id}/tracks`, { query: { limit: 50, offset } }),
    artist: (id) => request("GET", `/artists/${id}`),
    artistAlbums: (id) => request("GET", `/artists/${id}/albums`, { query: { include_groups: "album,single", limit: 20 } }),
    // since February 2026: at most 10 results per type
    search: (q) => request("GET", "/search", { query: { q, type: "track,artist,album,playlist", limit: 10 } }),

    // since February 2026: library via Spotify URIs
    isSaved: (uris) => request("GET", "/me/library/contains", { query: { uris: uriList(uris) } }),
    save: (uris) => request("PUT", "/me/library", { query: { uris: uriList(uris) } }),
    unsave: (uris) => request("DELETE", "/me/library", { query: { uris: uriList(uris) } }),
  };
}
