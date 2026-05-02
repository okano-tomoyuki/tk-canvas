const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',

    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({ text, location }) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};

async function main() {

    //
    // ① extension.ts（Node.js側）
    //
    const ext = esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.js',
        external: ['vscode'],
        logLevel: 'silent',
        plugins: [esbuildProblemMatcherPlugin],
    });

    //
    // ② Webview（ブラウザ側）
    //
    const web = esbuild.context({
        entryPoints: ['src/webview/main.ts'],
        bundle: true,
        format: 'esm',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'browser',
        outdir: 'dist/webview',
        logLevel: 'silent',
        plugins: [esbuildProblemMatcherPlugin],
    });

    if (watch) {
        await (await ext).watch();
        await (await web).watch();
    } else {
        await (await ext).rebuild();
        await (await web).rebuild();
        await (await ext).dispose();
        await (await web).dispose();
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
