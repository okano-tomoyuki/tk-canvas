import type { AnyNode } from '@tk-designer/core';
import { moveSelected, removeSelected } from '../editing.ts';
import { useDocumentStore, useSelectedNode, useUiStore } from '../store/stores.ts';

export function WidgetTree() {
  const root = useDocumentStore((s) => s.document?.root);
  const selected = useSelectedNode();
  const canEdit = selected?.parent !== undefined;

  if (!root) return null;
  return (
    <section className="panel" aria-label="ウィジェットツリー">
      <h2>ウィジェット</h2>
      <div className="toolbar">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => {
            moveSelected(-1);
          }}
        >
          ↑ 上へ
        </button>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => {
            moveSelected(1);
          }}
        >
          ↓ 下へ
        </button>
        <button type="button" disabled={!canEdit} onClick={removeSelected}>
          削除
        </button>
      </div>
      <ul className="tree" role="tree">
        <TreeItem node={root} />
      </ul>
    </section>
  );
}

function TreeItem({ node }: { readonly node: AnyNode }) {
  const isSelected = useUiStore((s) => s.selectedId === node.id);
  const select = useUiStore((s) => s.select);
  const children = node.children ?? [];

  return (
    <li role="treeitem" aria-selected={isSelected} aria-expanded={children.length > 0 || undefined}>
      <button
        type="button"
        className={isSelected ? 'tree-label selected' : 'tree-label'}
        onClick={() => {
          select(node.id);
        }}
      >
        <span className="tree-id">{node.id}</span>
        <span className="tree-class">{node.class}</span>
      </button>
      {children.length > 0 && (
        <ul role="group">
          {children.map((child) => (
            <TreeItem key={child.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
