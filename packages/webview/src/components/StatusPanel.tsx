import { useDocumentStore } from '../store/stores.ts';

/** 拒否された編集の理由と、検証結果（診断）を表示する */
export function StatusPanel() {
  const lastError = useDocumentStore((s) => s.lastError);
  const clearError = useDocumentStore((s) => s.clearError);
  const diagnostics = useDocumentStore((s) => s.diagnostics);

  return (
    <section className="panel status" aria-label="状態">
      {lastError && (
        <div role="alert" className="error">
          {lastError}
          <button type="button" onClick={clearError} aria-label="閉じる">
            ×
          </button>
        </div>
      )}
      {diagnostics.length > 0 && (
        <ul>
          {diagnostics.map((d, i) => (
            // 診断は毎回作り直される一覧で並べ替えも起きないため、添字をキーにしてよい
            <li key={i} className={d.severity}>
              [{d.severity}] {d.path.join('.') || '(ルート)'}: {d.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
