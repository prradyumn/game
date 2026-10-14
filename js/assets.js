/* Asset helpers: paths, trimmed pixel sizes, preloading. */
window.ISL = window.ISL || {};
(function (ISL) {
  'use strict';
  const SIZES = window.ASSET_SIZES || {};

  const A = {
    /** URL for an asset key like "snakes/python/head-alert" */
    url(key) {
      const s = SIZES[key];
      if (!s) { console.warn('[assets] unknown key', key); return 'assets/' + key + '.png'; }
      return 'assets/' + key + '.' + s[2];
    },
    /** [w,h] natural (trimmed) size in px */
    size(key) {
      const s = SIZES[key];
      return s ? [s[0], s[1]] : [100, 100];
    },
    /** height for a given width keeping the trimmed aspect ratio */
    hForW(key, w) { const [nw, nh] = A.size(key); return w * nh / nw; },
    wForH(key, h) { const [nw, nh] = A.size(key); return h * nw / nh; },
    images: {},
    /** Preload every asset; resolves when all are decoded (errors don't block). */
    preloadAll(onProgress) {
      const keys = Object.keys(SIZES);
      let done = 0;
      return Promise.all(keys.map(k => new Promise(res => {
        const img = new Image();
        img.onload = img.onerror = () => {
          done++; onProgress && onProgress(done / keys.length);
          A.images[k] = img; res();
        };
        img.src = A.url(k);
      })));
    },
    img(key) { return A.images[key]; }
  };
  ISL.assets = A;
})(window.ISL);
