import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// ビルド成果物は拡張パッケージの中に出力し、拡張と一緒に梱包する。
// 拡張側から参照しやすいよう、ファイル名にハッシュを付けない。
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../extension/dist/webview', import.meta.url)),
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
      output: {
        entryFileNames: 'main.js',
        assetFileNames: '[name][extname]',
      },
    },
  },
});
