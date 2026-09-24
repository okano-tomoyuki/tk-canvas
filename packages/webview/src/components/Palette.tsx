import { getWidgetCatalog, type WidgetCategory, type WidgetClassInfo } from '@tk-designer/core';
import { addWidget } from '../editing.ts';
import { useUiStore } from '../store/stores.ts';

const CATEGORY_LABELS: Readonly<Record<Exclude<WidgetCategory, 'window'>, string>> = {
  container: 'コンテナ',
  basic: '基本',
  input: '入力',
  selection: '選択',
  display: '表示',
  other: 'その他',
};

/** パレットに並べるクラス（補足情報の整備済みのもの）をカテゴリ別にまとめる。カタログは不変なので1回だけ計算する */
const GROUPS = Object.entries(CATEGORY_LABELS).map(([category, label]) => ({
  category,
  label,
  classes: [...getWidgetCatalog().classes.values()].filter(
    (c: WidgetClassInfo) => c.curated && c.category === category,
  ),
}));

export function Palette() {
  const setDragging = useUiStore((s) => s.setDragging);
  return (
    <section className="panel" aria-label="パレット">
      <h2>パレット</h2>
      {GROUPS.map((group) => (
        <div key={group.category} className="palette-group">
          <h3>{group.label}</h3>
          <div className="palette-items">
            {group.classes.map((c) => (
              <button
                key={c.name}
                type="button"
                title={`${c.name} を追加（クリックで選択中の位置へ、ドラッグでキャンバスの任意の位置へ）`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'copy';
                  e.dataTransfer.setData('text/plain', c.name);
                  setDragging({ kind: 'new', className: c.name });
                }}
                onDragEnd={() => {
                  setDragging(undefined);
                }}
                onClick={() => {
                  addWidget(c.name);
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
