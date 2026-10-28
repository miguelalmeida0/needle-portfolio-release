const root = globalThis;
function clampCrop(r) {
  const finite = (v, f) => Number.isFinite(v) ? v : f, round = (v) => Math.round(v * 1e6) / 1e6;
  const x = Math.max(0, Math.min(0.97, finite(r.x, 0))), y = Math.max(0, Math.min(0.97, finite(r.y, 0)));
  return { x: round(x), y: round(y), width: round(Math.max(0.03, Math.min(1 - x, finite(r.width, 0.45)))), height: round(Math.max(0.03, Math.min(1 - y, finite(r.height, 0.45)))) };
}
function rank(q, index, exclude) {
  return Object.entries(index).filter(([id, v]) => +id !== +exclude && v.length === 96).map(([id, v]) => {
    let d = 0;
    for (let i = 0; i < 64; i++) d += Math.abs(v[i] - q[i]);
    for (let i = 80; i < 96; i++) d += Math.abs(v[i] - q[i]) * 0.5;
    return { id: +id, d };
  }).sort((a, b) => a.d - b.d || a.id - b.id).map((a) => a.id);
}
function loadImage(url, { timeoutMs = 8e3, ImageClass = root.Image } = {}) {
  return new Promise((resolve, reject) => {
    const img = new ImageClass();
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = img.onerror = null;
      error ? reject(error) : resolve(img);
    };
    const timer = setTimeout(() => finish(new Error("The image took too long to load. Try again.")), timeoutMs);
    img.crossOrigin = "anonymous";
    img.onload = () => finish(img.naturalWidth ? null : new Error("This image could not load. Try again."));
    img.onerror = () => finish(new Error("This image could not load for detail search. Try again or choose another artwork."));
    img.src = url;
  });
}
function describe(image, crop) {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const r = clampCrop(crop);
  ctx.drawImage(image, image.naturalWidth * r.x, image.naturalHeight * r.y, image.naturalWidth * r.width, image.naturalHeight * r.height, 0, 0, 32, 32);
  const p = ctx.getImageData(0, 0, 32, 32).data, h = Array(64).fill(0), g = Array(16).fill(0), t = Array(16).fill(0), lum = (i) => (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4, b = Math.floor(y / 8) * 4 + Math.floor(x / 8);
    h[Math.floor(p[i] / 64) * 16 + Math.floor(p[i + 1] / 64) * 4 + Math.floor(p[i + 2] / 64)] += 1 / 1024;
    g[b] += lum(i) / 64;
    if (x < 31) t[b] += Math.abs(lum(i) - lum(i + 4)) / 64;
  }
  return [...h, ...g, ...t];
}
function imageSources(a, local) {
  return [...new Set([local, a.imageUrl, a.thumbnailUrl, a.detailImageUrl, a.imageSourceUrl, ...a.detailImageFallbackUrls || [], ...a.thumbnailFallbackUrls || []].filter(Boolean))];
}
async function loadFirstImage(urls, options = {}) {
  const start = Date.now(), budget = options.timeoutMs || 8e3;
  let last;
  for (const url of urls) {
    const remaining = budget - (Date.now() - start);
    if (remaining <= 0) throw new Error("The image took too long to load. Try again.");
    try {
      return await loadImage(url, { ...options, timeoutMs: remaining });
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("This image could not load. Try another artwork.");
}
function compareState(ids, id) {
  const selected = ids.includes(id);
  return { selected, label: selected ? "Selected for comparison" : "Compare" };
}
export {
  clampCrop,
  compareState,
  describe,
  imageSources,
  loadFirstImage,
  loadImage,
  rank
};
