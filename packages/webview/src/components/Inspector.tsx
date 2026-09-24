import { useState } from 'react';
import { renameWidget } from '../editing.ts';
import { useSelectedNode } from '../store/stores.ts';

/** 選択中のウィジェットの情報。プロパティエディタは次の段階で作る */
export function Inspector() {
  const selected = useSelectedNode();

  if (!selected) {
    return (
      <section className="panel" aria-label="インスペクタ">
        <h2>インスペクタ</h2>
        <p className="muted">ウィジェットを選択してください</p>
      </section>
    );
  }
  const { node } = selected;
  return (
    <section className="panel" aria-label="インスペクタ">
      <h2>インスペクタ</h2>
      {/* key で選択が変わるたびに入力欄を作り直し、編集途中の値を持ち越さない */}
      <IdField key={node.id} id={node.id} />
      <dl>
        <dt>class</dt>
        <dd>{node.class}</dd>
      </dl>
      <pre>{JSON.stringify(node, null, 2)}</pre>
    </section>
  );
}

function IdField({ id }: { readonly id: string }) {
  const [draft, setDraft] = useState(id);
  const commit = () => {
    if (draft !== id) renameWidget(id, draft);
  };
  return (
    <label className="field">
      id
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(id);
        }}
      />
    </label>
  );
}
