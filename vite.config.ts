import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';

/** Все файлы из public/ (иконки, манифест) — их тоже надо положить в офлайн-кэш. */
function publicFiles(dir = 'public'): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? publicFiles(p) : [relative('public', p).split('\\').join('/')];
  });
}

/** Service worker: кладёт всю собранную игру в кэш, чтобы она работала без интернета. */
function offline(): Plugin {
  return {
    name: 'offline-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = [...Object.keys(bundle), ...publicFiles()].filter((f) => !f.endsWith('.map'));
      const version = createHash('sha1').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const source = `// создано сборкой — не править
const CACHE = 'master-${version}';
const FILES = ${JSON.stringify(['./', ...files])};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((r) => r || fetch(e.request)));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  build: { assetsInlineLimit: 0 },
  plugins: [offline()],
  test: { include: ['tests/**/*.test.ts'] },
});
