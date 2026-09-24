import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

// core / codegen は VS Code・DOM・Node に依存しない（docs/architecture.md）
const pureModuleRestrictions = {
  patterns: [
    { group: ['vscode'], message: 'core / codegen では VS Code API を使わない' },
    {
      group: ['node:*', 'fs', 'path', 'os', 'child_process'],
      message: 'core / codegen では Node API を使わない',
    },
    { group: ['react', 'react-dom', 'react/*'], message: 'core / codegen では React を使わない' },
  ],
};

export default defineConfig(
  { ignores: ['**/dist/**', '**/coverage/**', 'docs/**'] },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: [
            '*.js',
            '*.ts',
            'packages/*/vitest.config.ts',
            'packages/*/vite.config.ts',
          ],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['packages/core/**', 'packages/codegen/**'],
    rules: { 'no-restricted-imports': ['error', pureModuleRestrictions] },
  },
  {
    files: ['packages/webview/src/**'],
    languageOptions: { globals: globals.browser },
    extends: [reactHooks.configs.flat['recommended-latest']],
  },
  {
    files: [
      'packages/cli/**',
      'packages/extension/**',
      '*.js',
      '*.ts',
      'packages/*/vite.config.ts',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // 設定ファイル（JS）は型情報を持たないプラグインを読み込むため、型情報を使うルールを外す
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
