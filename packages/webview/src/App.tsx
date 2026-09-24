import { useDocument } from './useDocument.js';

export function App() {
  const doc = useDocument();

  switch (doc.status) {
    case 'loading':
      return <p>読み込み中…</p>;
    case 'invalid':
      return (
        <div role="alert">
          <h2>DSL を解析できません</h2>
          <pre>{doc.error}</pre>
        </div>
      );
    case 'ok':
      return (
        <div>
          <h2>tk-designer</h2>
          <p>version: {doc.version}</p>
          <pre>{JSON.stringify(doc.data, null, 2)}</pre>
        </div>
      );
  }
}
