import {
  formatValue,
  getWidgetCatalog,
  parseInteger,
  type AnyNode,
  type Diagnostic,
  type JsonPath,
  type Layout,
} from '@tk-designer/core';
import { useDocumentStore } from '../../store/stores.ts';
import { messagesAt } from './diagnostics.ts';
import { booleanOptions, CompactInput, SelectField, toBoolean } from './fields.tsx';

type GridLayout = Extract<Layout, { manager: 'grid' }>;
type GridLines = NonNullable<GridLayout['columns']>;
type GridLine = GridLines[string];

interface LayoutSectionProps {
  readonly node: AnyNode;
  readonly nodePath: JsonPath | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

/** コンテナが子をどう並べるか（layout）の編集 */
export function LayoutSection({ node, nodePath, diagnostics }: LayoutSectionProps) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  if (getWidgetCatalog().classes.get(node.class)?.children !== 'layout') return null;

  const layout = node.layout;
  const layoutPath = nodePath && [...nodePath, 'layout'];
  const hasChildren = (node.children ?? []).length > 0;
  const setLayout = (next: Layout | undefined) => {
    dispatch({ type: 'setLayout', id: node.id, layout: next });
  };

  return (
    <section className="inspector-section">
      <h3>レイアウト（子の並べ方）</h3>
      <SelectField
        label="manager"
        value={layout?.manager ?? ''}
        options={[
          ...(hasChildren ? [] : [{ value: '', label: '（なし）' }]),
          { value: 'pack', label: 'pack' },
          { value: 'grid', label: 'grid' },
          { value: 'place', label: 'place' },
        ]}
        error={messagesAt(diagnostics, layoutPath && [...layoutPath, 'manager'])}
        onChange={(v) => {
          setLayout(v === 'pack' || v === 'grid' || v === 'place' ? { manager: v } : undefined);
        }}
      />
      {hasChildren && (
        <p className="inspector-note">
          manager を変えると、子の配置（placement）は新しい manager の初期値になります。
        </p>
      )}
      {layout && layout.manager !== 'place' && (
        <SelectField
          label="propagate"
          value={layout.propagate === undefined ? '' : String(layout.propagate)}
          options={booleanOptions('true')}
          onChange={(v) => {
            setLayout({ ...layout, propagate: toBoolean(v) });
          }}
        />
      )}
      {layout?.manager === 'grid' && (
        <>
          <GridLinesTable
            title="列（grid_columnconfigure）"
            axis="columns"
            layout={layout}
            used={usedLines(node, 'column')}
            layoutPath={layoutPath}
            diagnostics={diagnostics}
            onChange={setLayout}
          />
          <GridLinesTable
            title="行（grid_rowconfigure）"
            axis="rows"
            layout={layout}
            used={usedLines(node, 'row')}
            layoutPath={layoutPath}
            diagnostics={diagnostics}
            onChange={setLayout}
          />
        </>
      )}
    </section>
  );
}

/** 子が使っている行・列の数（span を含む） */
function usedLines(node: AnyNode, axis: 'row' | 'column'): number {
  let rowEnd = 0;
  let max = 0;
  for (const child of node.children ?? []) {
    const p = (child.placement ?? {}) as Record<string, unknown>;
    const span = typeof p[`${axis}span`] === 'number' ? (p[`${axis}span`] as number) : 1;
    const start = typeof p[axis] === 'number' ? p[axis] : axis === 'row' ? rowEnd : 0;
    if (axis === 'row') rowEnd = Math.max(rowEnd, start + span);
    max = Math.max(max, start + span);
  }
  return max;
}

const LINE_FIELDS = ['weight', 'minsize', 'pad', 'uniform'] as const;

interface GridLinesTableProps {
  readonly title: string;
  readonly axis: 'columns' | 'rows';
  readonly layout: GridLayout;
  readonly used: number;
  readonly layoutPath: JsonPath | undefined;
  readonly diagnostics: readonly Diagnostic[];
  readonly onChange: (layout: Layout) => void;
}

/** 行・列ごとの weight / minsize / pad / uniform。子が使っている行・列と、設定済みの行・列を並べる */
function GridLinesTable({
  title,
  axis,
  layout,
  used,
  layoutPath,
  diagnostics,
  onChange,
}: GridLinesTableProps) {
  const lines: GridLines = layout[axis] ?? {};
  const configured = Object.keys(lines).map(Number);
  const count = Math.max(used, ...configured.map((i) => i + 1), 1);

  const update = (
    index: number,
    field: (typeof LINE_FIELDS)[number],
    value: number | string | undefined,
  ) => {
    const line: Record<string, number | string | undefined> = {
      ...lines[String(index)],
      [field]: value,
    };
    const cleaned = Object.fromEntries(
      Object.entries(line).filter(([, v]) => v !== undefined),
    ) as GridLine;
    // 設定が空になった行・列は取り除く
    const next = Object.fromEntries(
      Object.entries({ ...lines, [String(index)]: cleaned }).filter(
        ([, config]) => Object.keys(config).length > 0,
      ),
    );
    onChange({ ...layout, [axis]: Object.keys(next).length > 0 ? next : undefined });
  };

  return (
    <div className="grid-lines">
      <h4>{title}</h4>
      <table>
        <thead>
          <tr>
            <th>#</th>
            {LINE_FIELDS.map((f) => (
              <th key={f}>{f}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: count }, (_, index) => {
            const line = lines[String(index)] ?? {};
            return (
              <tr key={index}>
                <th>{index}</th>
                {LINE_FIELDS.map((field) => (
                  <td key={field}>
                    <CompactInput
                      label={`${String(index)} の ${field}`}
                      value={formatValue(line[field])}
                      placeholder={field === 'uniform' ? '' : '0'}
                      error={messagesAt(
                        diagnostics,
                        layoutPath && [...layoutPath, axis, String(index), field],
                      )}
                      onCommit={(text) => {
                        if (field === 'uniform') {
                          update(index, field, text.trim() === '' ? undefined : text.trim());
                          return undefined;
                        }
                        const result = parseInteger(text);
                        if (!result.ok) return result.error;
                        if (result.value !== undefined && result.value < 0)
                          return '0 以上の整数で入力してください';
                        update(index, field, result.value);
                        return undefined;
                      }}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
