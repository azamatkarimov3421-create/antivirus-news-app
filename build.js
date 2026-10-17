// Vercel Build Script — Fayllarni public va dist papkalariga tayyorlash
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

const itemsToCopy = [
  'index.html',
  'css',
  'js',
  'assets',
  'manifest.json',
  'sw.js',
  'privacy.html',
  '.well-known',
  'vercel.json',
  'download'
];

// Ham public, ham dist papkalarini yaratish va to'ldirish
const targets = [
  path.join(__dirname, 'public'),
  path.join(__dirname, 'dist')
];

targets.forEach((targetDir) => {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  itemsToCopy.forEach((item) => {
    const srcPath = path.join(__dirname, item);
    const destPath = path.join(targetDir, item);
    if (fs.existsSync(srcPath)) {
      copyRecursiveSync(srcPath, destPath);
    }
  });

  console.log(`✅ Files successfully copied to: ${path.basename(targetDir)}`);
});

console.log('🚀 Build finished cleanly for Vercel!');
