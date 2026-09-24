import {
  containerKindOf,
  formatValue,
  parseInteger,
  parseNumber,
  parseNumberList,
  parsePad,
  type AnyNode,
  type ContainerKind,
  type Diagnostic,
  type InputResult,
  type JsonPath,
  type LiteralValue,
} from '@tk-designer/core';
import { useDocumentStore } from '../../store/stores.ts';
import { messagesAt } from './diagnostics.ts';
import {
  booleanOptions,
  enumOptions,
  FieldRow,
  SelectField,
  TextField,
  toBoolean,
} from './fields.tsx';

/** placement の1項目の編集方法 */
type PlacementField =
  | {
      readonly name: string;
      readonly kind: 'text' | 'int' | 'number' | 'pad';
      readonly placeholder: string;
    }
  | {
      readonly name: string;
      readonly kind: 'numbers';
      readonly counts: readonly number[];
      readonly placeholder: string;
    }
  | {
      readonly name: string;
      readonly kind: 'enum';
      readonly values: readonly string[];
      readonly placeholder: string;
    }
  | { readonly name: string; readonly kind: 'bool'; readonly placeholder: string }
  | { readonly name: string; readonly kind: 'sticky' };

const ANCHORS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw', 'center'];

/** 親の置き方ごとの項目（docs/dsl-spec.md §7.2） */
const FIELDS: Readonly<Record<ContainerKind, readonly PlacementField[]>> = {
  pack: [
    { name: 'side', kind: 'enum', values: ['top', 'bottom', 'left', 'right'], placeholder: 'top' },
    { name: 'fill', kind: 'enum', values: ['none', 'x', 'y', 'both'], placeholder: 'none' },
    { name: 'expand', kind: 'bool', placeholder: 'false' },
    { name: 'anchor', kind: 'enum', values: ANCHORS, placeholder: 'center' },
    { name: 'padx', kind: 'pad', placeholder: '0' },
    { name: 'pady', kind: 'pad', placeholder: '0' },
    { name: 'ipadx', kind: 'number', placeholder: '0' },
    { name: 'ipady', kind: 'number', placeholder: '0' },
  ],
  grid: [
    { name: 'row', kind: 'int', placeholder: '前の行の次' },
    { name: 'column', kind: 'int', placeholder: '0' },
    { name: 'rowspan', kind: 'int', placeholder: '1' },
    { name: 'columnspan', kind: 'int', placeholder: '1' },
    { name: 'sticky', kind: 'sticky' },
    { name: 'padx', kind: 'pad', placeholder: '0' },
    { name: 'pady', kind: 'pad', placeholder: '0' },
    { name: 'ipadx', kind: 'number', placeholder: '0' },
    { name: 'ipady', kind: 'number', placeholder: '0' },
  ],
  place: [
    { name: 'x', kind: 'number', placeholder: '0' },
    { name: 'y', kind: 'number', placeholder: '0' },
    { name: 'relx', kind: 'number', placeholder: '0' },
    { name: 'rely', kind: 'number', placeholder: '0' },
    { name: 'width', kind: 'number', placeholder: '要求サイズ' },
    { name: 'height', kind: 'number', placeholder: '要求サイズ' },
    { name: 'relwidth', kind: 'number', placeholder: '—' },
    { name: 'relheight', kind: 'number', placeholder: '—' },
    { name: 'anchor', kind: 'enum', values: ANCHORS, placeholder: 'nw' },
    {
      name: 'bordermode',
      kind: 'enum',
      values: ['inside', 'outside', 'ignore'],
      placeholder: 'inside',
    },
  ],
  notebook: [
    { name: 'text', kind: 'text', placeholder: '（なし）' },
    { name: 'underline', kind: 'int', placeholder: '-1' },
    { name: 'sticky', kind: 'sticky' },
    { name: 'padding', kind: 'numbers', counts: [1, 2, 4], placeholder: '0' },
    {
      name: 'state',
      kind: 'enum',
      values: ['normal', 'disabled', 'hidden'],
      placeholder: 'normal',
    },
  ],
  paned: [{ name: 'weight', kind: 'int', placeholder: '0' }],
};

const KIND_LABELS: Readonly<Record<ContainerKind, string>> = {
  pack: 'pack',
  grid: 'grid',
  place: 'place',
  notebook: 'Notebook のタブ',
  paned: 'PanedWindow のペイン',
};

interface PlacementSectionProps {
  readonly node: AnyNode;
  readonly parent: AnyNode;
  readonly nodePath: JsonPath | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

/** 親の中での置き方（placement）の編集 */
export function PlacementSection({ node, parent, nodePath, diagnostics }: PlacementSectionProps) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  const kind = containerKindOf(parent);
  if (!kind) return null;

  // ルートには placement がない（このセクションは親を持つウィジェットでのみ表示する）
  const placement = (('placement' in node ? node.placement : undefined) ?? {}) as Readonly<
    Record<string, LiteralValue | undefined>
  >;
  const placementPath = nodePath && [...nodePath, 'placement'];
  const update = (name: string, value: LiteralValue | undefined) => {
    const next = Object.fromEntries(
      Object.entries({ ...placement, [name]: value }).filter(([, v]) => v !== undefined),
    );
    dispatch({
      type: 'setPlacement',
      id: node.id,
      placement: Object.keys(next).length > 0 ? next : undefined,
    });
  };

  return (
    <section className="inspector-section">
      <h3>配置（親: {KIND_LABELS[kind]}）</h3>
      {messagesAt(diagnostics, placementPath, true) && (
        <div className="field-error" role="alert">
          {messagesAt(diagnostics, placementPath, true)}
        </div>
      )}
      {FIELDS[kind].map((field) => (
        <PlacementFieldView
          key={`${kind}:${field.name}`}
          field={field}
          value={placement[field.name]}
          error={messagesAt(diagnostics, placementPath && [...placementPath, field.name])}
          onChange={(value) => {
            update(field.name, value);
          }}
        />
      ))}
    </section>
  );
}

interface PlacementFieldViewProps {
  readonly field: PlacementField;
  readonly value: LiteralValue | undefined;
  readonly error: string | undefined;
  readonly onChange: (value: LiteralValue | undefined) => void;
}

function PlacementFieldView({ field, value, error, onChange }: PlacementFieldViewProps) {
  switch (field.kind) {
    case 'enum':
      return (
        <SelectField
          label={field.name}
          value={typeof value === 'string' ? value : ''}
          options={enumOptions(field.values, field.placeholder)}
          error={error}
          onChange={(v) => {
            onChange(v === '' ? undefined : v);
          }}
        />
      );
    case 'bool':
      return (
        <SelectField
          label={field.name}
          value={typeof value === 'boolean' ? String(value) : ''}
          options={booleanOptions(field.placeholder)}
          error={error}
          onChange={(v) => {
            onChange(toBoolean(v));
          }}
        />
      );
    case 'sticky':
      return (
        <StickyField
          value={typeof value === 'string' ? value : ''}
          error={error}
          onChange={onChange}
        />
      );
    default: {
      const parse = (text: string): InputResult<LiteralValue> => {
        switch (field.kind) {
          case 'int':
            return parseInteger(text);
          case 'number':
            return parseNumber(text);
          case 'pad':
            return parsePad(text);
          case 'numbers': {
            const result = parseNumberList(text, field.counts);
            // 1値の場合は数値そのものとして書く
            return result.ok && result.value?.length === 1
              ? { ok: true, value: result.value[0] }
              : result;
          }
          case 'text':
            return { ok: true, value: text === '' ? undefined : text };
        }
      };
      return (
        <TextField
          label={field.name}
          value={formatValue(value)}
          placeholder={`既定: ${field.placeholder}`}
          error={error}
          onCommit={(text) => {
            const result = parse(text);
            if (!result.ok) return result.error;
            onChange(result.value);
            return undefined;
          }}
        />
      );
    }
  }
}

const STICKY_SIDES = ['n', 's', 'e', 'w'] as const;

/** sticky: n / s / e / w のチェックボックス（順序は "nsew" に揃える） */
function StickyField({
  value,
  error,
  onChange,
}: {
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string | undefined) => void;
}) {
  return (
    <FieldRow label="sticky" error={error}>
      <div className="sticky-options">
        {STICKY_SIDES.map((side) => (
          <label key={side}>
            <input
              type="checkbox"
              checked={value.includes(side)}
              onChange={(e) => {
                const next = STICKY_SIDES.filter((s) =>
                  s === side ? e.target.checked : value.includes(s),
                ).join('');
                onChange(next === '' ? undefined : next);
              }}
            />
            {side}
          </label>
        ))}
      </div>
    </FieldRow>
  );
}
