import { defineConfig } from 'vite';
import { readdirSync, copyFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 自动发现所有根目录 HTML 文件作为多页面入口
const htmlFiles = readdirSync(__dirname).filter(f => f.endsWith('.html'));
const input = Object.fromEntries(
  htmlFiles.map(f => [f.replace(/\.html$/, ''), resolve(__dirname, f)])
);

console.log(`📄 MPA entries: ${Object.keys(input).join(', ')}`);

export default defineConfig({
  appType: 'mpa',  // 多页面模式：dev 服务器正确服务所有 HTML 文件
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input,
    },
  },
  plugins: [
    {
      name: 'copy-non-module-assets',
      closeBundle() {
        // 非 module 脚本（stub-runtime.js, api-client.js）Vite 不处理
        // 手动复制到 dist/assets/ 确保部署后可用
        const srcDir = resolve(__dirname, 'assets');
        const dstDir = resolve(__dirname, 'dist', 'assets');
        if (!existsSync(dstDir)) {
          mkdirSync(dstDir, { recursive: true });
        }
        for (const file of ['stub-runtime.js', 'api-client.js']) {
          const src = resolve(srcDir, file);
          const dst = resolve(dstDir, file);
          if (existsSync(src)) {
            copyFileSync(src, dst);
            console.log(`  ✅ Copied: ${file} → dist/assets/`);
          }
        }
      },
    },
  ],
  server: {
    port: 3000,
    open: true,
  },
});
