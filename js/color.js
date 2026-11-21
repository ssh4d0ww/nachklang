// Holt eine kräftige, aber dunkle Grundfarbe aus einem Cover.
// Gibt [r, g, b] zurück oder null, wenn das Bild nicht lesbar ist.
export function coverTint(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, size, size);
        const d = ctx.getImageData(0, 0, size, size).data;
        let r = 0, g = 0, b = 0, w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const R = d[i], G = d[i + 1], B = d[i + 2];
          const max = Math.max(R, G, B), min = Math.min(R, G, B);
          const sat = max ? (max - min) / max : 0;
          const lum = max / 255;
          // bunte, mittelhelle Pixel zählen mehr als Grau, Schwarz oder Weiß
          const weight = 0.08 + sat * sat * (lum > 0.15 && lum < 0.95 ? 2 : 0.3);
          r += R * weight; g += G * weight; b += B * weight; w += weight;
        }
        resolve(darken([r / w, g / w, b / w]));
      } catch {
        resolve(null); // fremdes Bild ohne CORS: Canvas ist gesperrt
      }
    };
    img.src = url;
  });
}

// auf eine Helligkeit bringen, auf der weißer Text gut lesbar bleibt
function darken([r, g, b]) {
  const max = Math.max(r, g, b, 1);
  const target = Math.min(max, 150);
  const f = target / max;
  return [r, g, b].map((v) => Math.round(v * f));
}
