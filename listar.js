import fs from 'fs';
import path from 'path';

const ignore = ['node_modules', '.git', 'dist', 'build', '.vite', 'coverage'];
function walk(dir, prefix = '') {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    if (ignore.includes(f)) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      console.log(prefix + '📁 ' + f + '/');
      walk(full, prefix + '  ');
    } else {
      console.log(prefix + '📄 ' + f);
    }
  }
}
walk('.');