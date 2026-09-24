import { jsonPathOf } from '@tk-designer/core';
import { renameWidget } from '../../editing.ts';
import { useDocumentStore, useSelectedNode } from '../../store/stores.ts';
import { messagesAt } from './diagnostics.ts';
import { EventsSection } from './EventsSection.tsx';
import { FieldRow, TextField } from './fields.tsx';
import { LayoutSection } from './LayoutSection.tsx';
import { OptionsSection } from './OptionsSection.tsx';
import { PlacementSection } from './PlacementSection.tsx';
import { WindowSection } from './WindowSection.tsx';

/** 選択中のウィジェットのプロパティエディタ */
export function Inspector() {
  const selected = useSelectedNode();
  const doc = useDocumentStore((s) => s.document);
  const diagnostics = useDocumentStore((s) => s.diagnostics);

  if (!selected || !doc) {
    return (
      <section className="panel inspector" aria-label="インスペクタ">
        <h2>インスペクタ</h2>
        <p className="muted">ウィジェットを選択してください</p>
      </section>
    );
  }

  const { node, parent } = selected;
  const nodePath = jsonPathOf(doc, node.id);
  const isRoot = parent === undefined;

  return (
    <section className="panel inspector" aria-label="インスペクタ">
      <h2>インスペクタ</h2>
      <section className="inspector-section">
        <TextField
          label="id"
          value={node.id}
          error={messagesAt(diagnostics, nodePath && [...nodePath, 'id'])}
          onCommit={(text) => {
            const newId = text.trim();
            if (newId !== node.id) renameWidget(node.id, newId);
            return undefined;
          }}
        />
        <FieldRow label="class">
          <span>{node.class}</span>
        </FieldRow>
      </section>
      {isRoot && <WindowSection window={doc.root.window} diagnostics={diagnostics} />}
      {parent && (
        <PlacementSection
          node={node}
          parent={parent}
          nodePath={nodePath}
          diagnostics={diagnostics}
        />
      )}
      <LayoutSection node={node} nodePath={nodePath} diagnostics={diagnostics} />
      <OptionsSection key={node.id} node={node} nodePath={nodePath} diagnostics={diagnostics} />
      <EventsSection node={node} nodePath={nodePath} diagnostics={diagnostics} />
    </section>
  );
}
