// web/js altındaki ortak modülleri (bina modeli, rota, eşleştirme, QR) ve firma verisini
// mobile/src/core'a kopyalar. Tek kaynak web/js; buradaki kopyaları elle düzenleme.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'mobile', 'src', 'core');
mkdirSync(out, { recursive: true });
for (const f of ['layout.js', 'nav.js', 'data.js', 'qr.js']) {
  const src = readFileSync(join(root, 'web', 'js', f), 'utf8');
  writeFileSync(join(out, f), `// OTOMATİK KOPYA — kaynak: web/js/${f} (npm run sync-core)\n${src}`);
}
copyFileSync(join(root, 'web', 'data', 'firms.json'), join(out, 'firms.json'));
console.log('core senkronlandı →', out);
