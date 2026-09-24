import type { Diagnostic } from '@tk-designer/core';
import { useDocument } from './useDocument.ts';

export function App() {
  const state = useDocument();

  if (state.status === 'loading') {
    return <p>読み込み中…</p>;
  }
  return (
    <div>
      <h2>tk-designer</h2>
      <p>version: {state.version}</p>
      <DiagnosticList diagnostics={state.diagnostics} />
      {state.document && <pre>{JSON.stringify(state.document, null, 2)}</pre>}
    </div>
  );
}

function DiagnosticList({ diagnostics }: { readonly diagnostics: readonly Diagnostic[] }) {
  if (diagnostics.length === 0) return null;
  return (
    <ul role="alert">
      {diagnostics.map((d, i) => (
        // 診断は毎回作り直される一覧で並べ替えも起きないため、添字をキーにしてよい
        <li key={i}>
          [{d.severity}] {d.path.join('.') || '(ルート)'}: {d.message}
        </li>
      ))}
    </ul>
  );
}
