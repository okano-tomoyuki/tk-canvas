/**
 * コード生成の画面（docs/adr/0010、docs/adr/0011）。
 * 生成する言語と、クラス名・出力先を指定して生成する。設定は DSL の codegen に保存する（Undo できる）。
 * 空欄は既定値（DSL のファイル名から決まる名前）を表す。
 */
import { baseName, toClassName } from '@tk-designer/codegen';
import { hasErrors, type CodegenSettings } from '@tk-designer/core';
import { useDocumentStore, useUiStore } from '../store/stores.ts';
import { postMessage } from '../vscode.ts';
import { messagesAt } from './inspector/diagnostics.ts';
import { TextField } from './inspector/fields.tsx';

type Target = keyof CodegenSettings;

export function CodegenView() {
  const doc = useDocumentStore((s) => s.document);
  const diagnostics = useDocumentStore((s) => s.diagnostics);
  const fileName = useDocumentStore((s) => s.fileName);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const setView = useUiStore((s) => s.setView);
  if (!doc) return null;

  const codegen = doc.codegen ?? {};
  const base = baseName(fileName);
  const defaultClassName = toClassName(base);
  const update = (next: CodegenSettings) => {
    dispatch({ type: 'setCodegen', codegen: next });
  };
  const toggle = (target: Target, enabled: boolean) => {
    update({ ...codegen, [target]: enabled ? {} : undefined });
  };
  /** 空欄は既定値（項目を書かない）。入力はその場で確定するため、エラーは返さない */
  const setField = (target: Target, key: string, text: string): string | undefined => {
    const value = text.trim();
    const entries = Object.entries(codegen[target] ?? {}).filter(([k]) => k !== key);
    if (value !== '') entries.push([key, value]);
    update({ ...codegen, [target]: Object.fromEntries(entries) });
    return undefined;
  };
  const errorAt = (target: Target, key: string) =>
    messagesAt(diagnostics, ['codegen', target, key]);

  const enabled = codegen.python !== undefined || codegen.cpp !== undefined;
  const blocked = hasErrors(diagnostics);

  return (
    <main className="codegen-view">
      <header className="codegen-header">
        <button
          type="button"
          onClick={() => {
            setView('design');
          }}
        >
          ← デザイナーに戻る
        </button>
        <h2>コード生成</h2>
      </header>

      <p className="muted">
        生成するクラスは {doc.root.class}（DSL のルート）を継承します。空欄の項目は既定値（DSL
        のファイル名から決まる名前）になります。パスは DSL
        ファイルのあるフォルダからの相対パスです。 設定は DSL の codegen に保存されます。
      </p>

      <section className="codegen-target">
        <label className="codegen-toggle">
          <input
            type="checkbox"
            checked={codegen.python !== undefined}
            onChange={(e) => {
              toggle('python', e.target.checked);
            }}
          />
          Python（tkinter）
        </label>
        {codegen.python && (
          <div className="codegen-fields">
            <TextField
              label="クラス名"
              value={codegen.python.className ?? ''}
              placeholder={defaultClassName}
              error={errorAt('python', 'className')}
              onCommit={(text) => setField('python', 'className', text)}
            />
            <TextField
              label="ファイル"
              value={codegen.python.file ?? ''}
              placeholder={`${base}.py`}
              error={errorAt('python', 'file')}
              onCommit={(text) => setField('python', 'file', text)}
            />
          </div>
        )}
      </section>

      <section className="codegen-target">
        <label className="codegen-toggle">
          <input
            type="checkbox"
            checked={codegen.cpp !== undefined}
            onChange={(e) => {
              toggle('cpp', e.target.checked);
            }}
          />
          C++（cpp_tk）
        </label>
        {codegen.cpp && (
          <div className="codegen-fields">
            <TextField
              label="クラス名"
              value={codegen.cpp.className ?? ''}
              placeholder={defaultClassName}
              error={errorAt('cpp', 'className')}
              onCommit={(text) => setField('cpp', 'className', text)}
            />
            <TextField
              label="ヘッダ"
              value={codegen.cpp.header ?? ''}
              placeholder={`${base}.hpp`}
              error={errorAt('cpp', 'header')}
              onCommit={(text) => setField('cpp', 'header', text)}
            />
            <TextField
              label="ソース"
              value={codegen.cpp.source ?? ''}
              placeholder={`${base}.cpp`}
              error={errorAt('cpp', 'source')}
              onCommit={(text) => setField('cpp', 'source', text)}
            />
          </div>
        )}
      </section>

      <footer className="codegen-footer">
        <button
          type="button"
          className="primary"
          disabled={!enabled || blocked}
          onClick={() => {
            postMessage({ type: 'generateCode' });
          }}
        >
          生成する
        </button>
        <span className="muted">
          {!enabled
            ? '生成する言語を選んでください'
            : blocked
              ? 'DSL に検証エラーがあるため生成できません'
              : '既存のファイルはマーカー区間だけを更新します'}
        </span>
      </footer>
    </main>
  );
}
