# Nachklang

Spotify-Fernbedienung im Liner-Look, als Web-App (PWA) fürs Handy und den PC.
Die Musik läuft weiter in Spotify, Nachklang steuert sie über die offizielle Spotify Web API.

## Funktionen

- Aktuelles Lied mit großem Cover und unscharfem, eingefärbtem Cover-Hintergrund
- Play/Pause, vor/zurück, spulen (Balken ziehen), Zufall, Wiederholen (aus / alles / ein Lied)
- Lautstärke, wenn das Gerät sie von außen erlaubt
- Lieblingssong markieren (Herz)
- Warteschlange und „Zuletzt gehört“ (antippen spielt das Lied)
- Gerät wechseln (Spotify Connect)
- Demo-Modus ohne Spotify-Konto
- Installierbar auf dem Home-Bildschirm, App-Hülle funktioniert auch offline
- Am großen Bildschirm zweispaltig: Player links, Warteschlange rechts

## Technik

- Reines HTML, CSS und JavaScript (ES-Module), kein Build-Schritt, kein eigener Server
- Login: OAuth 2.0 Authorization Code mit PKCE direkt im Browser (`js/auth.js`)
- Der Status wird alle 2 Sekunden abgefragt, dazwischen zählt der Fortschritt lokal weiter
- Eigene Aktionen werden sofort angezeigt (optimistisch) und danach mit Spotify abgeglichen
- Der Demo-Modus (`js/demo.js`) liefert Daten im selben Format wie die echte API, die App nutzt also denselben Code

```
index.html            Aufbau der Seite
css/app.css           Design (Liner-Stil, Glas, Sheets, Layout für Handy und PC)
js/app.js             Zustand, Anzeige, Bedienung
js/auth.js            Login mit PKCE, Token speichern und erneuern
js/api.js             Spotify Web API (nur die benötigten Endpunkte)
js/demo.js            Simulation für den Demo-Modus
js/color.js           Grundfarbe aus dem Cover für den Hintergrund
js/icons.js           eigene Linien-Icons
js/config.js          Client ID, Redirect URI, Berechtigungen
sw.js                 Service Worker (Offline-Cache der App-Dateien)
manifest.webmanifest  App-Name, Icons, Vollbild
```

## Einrichten

1. **Spotify-App anlegen:** Auf developer.spotify.com/dashboard → „Create app“. Bei „Which API/SDKs“ die Web API wählen.
2. **Redirect URI eintragen:** Das ist genau die Adresse, unter der Nachklang läuft, mit `/` am Ende.
   - Lokal am PC: `http://127.0.0.1:8080/`. Spotify erlaubt `http` nur mit `127.0.0.1`, `localhost` ist nicht zugelassen.
   - Online, zum Beispiel: `https://DEINNAME.github.io/nachklang/`
   - Du kannst mehrere eintragen. Nachklang zeigt die passende Adresse beim Start unter „Woher bekomme ich die?“ an.
3. **Client ID:** Aus dem Dashboard kopieren und beim ersten Start einfügen. Alternativ fest in `js/config.js` eintragen.
4. **Entwicklungsmodus:** Der App-Besitzer braucht Premium, und neben dir dürfen bis zu fünf eingetragene Nutzer die App verwenden (Dashboard → User Management).

## Lokal starten

```
cd nachklang
python -m http.server 8080 --bind 127.0.0.1
```

Dann http://127.0.0.1:8080/ öffnen.

## Aufs iPhone

Dafür braucht es HTTPS, zum Beispiel über GitHub Pages (kostenlos):

1. Ein Repository anlegen, die Dateien hochladen und unter Settings → Pages den Branch `main` wählen.
2. Die Pages-Adresse als zusätzliche Redirect URI im Spotify Dashboard eintragen.
3. Auf dem iPhone die Adresse in Safari öffnen → Teilen → „Zum Home-Bildschirm“.
4. Den Login direkt in der installierten App machen. iOS trennt den Speicher von Safari und der Home-Bildschirm-App.

## Grenzen (von Spotify vorgegeben)

- Steuern geht nur mit Spotify Premium.
- Lieder in der Warteschlange lassen sich nicht direkt anspringen oder entfernen, dafür gibt es keinen Endpunkt.
- Manche Geräte, zum Beispiel iPhones, erlauben keine Lautstärke von außen.
- Nachklang spielt selbst keine Musik ab, es ist nur die Fernbedienung.

## Ideen für die nächsten Schritte

- Bibliothek und Playlists durchblättern, Suche
- TypeScript und Tests (z. B. Vitest), automatischer Check mit GitHub Actions
- Gesten: Cover wischen für vor/zurück
- Mehr Liner-Details: Songtext-Ansicht, Animationen beim Liedwechsel

---

Privates Lernprojekt, nicht mit Spotify oder Liner verbunden. Das Design ist von der Liner-Desktop-App inspiriert.
