const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function main() {

  //
  // ① VS Code 拡張本体（Node.js）
  //
  const ext = await esbuild.context({
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    minify: production,
    sourcemap: !production,
  });

  //
  // ② Webview 用スクリプト（Browser）
  //
  const web = await esbuild.context({
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    format: 'iife',              // ← 重要（esm は Webview で動かない）
    platform: 'browser',
    outdir: 'dist/webview',      // ← dist/webview に出力
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
  });

  if (watch) {
    console.log("[watch] build started");

    await Promise.all([
      ext.watch({
        onRebuild(error, result) {
          if (error) {
            console.error("[watch] build failed");
          } else {
            console.log("[watch] build finished");
          }
        },
      }),
      web.watch({
        onRebuild(error, result) {
          if (error) {
            console.error("[watch] build failed");
          } else {
            console.log("[watch] build finished");
          }
        },
      }),
    ]);
  } else {
    await ext.rebuild();
    await web.rebuild();
    await ext.dispose();
    await web.dispose();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
