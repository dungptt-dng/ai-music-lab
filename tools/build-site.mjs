/*
 * Tạo thư mục dist/ để đưa lên Cloudflare Pages: CHỈ chép những gì trình duyệt cần (index.html, css, js, img).
 * Không chép tests/, docs/, functions/, tools/, LENH.docx… lên trang công khai.
 * Thư mục functions/ được Cloudflare đóng gói riêng thành máy chủ.
 */
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const PUBLIC = ['index.html', 'css', 'js', 'img'];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);
for (const item of PUBLIC) {
  const from = join(root, item);
  if (!existsSync(from)) throw new Error('Thiếu ' + item);
  cpSync(from, join(dist, item), { recursive: true });
}
console.log('Đã tạo dist/ gồm: ' + PUBLIC.join(', '));
