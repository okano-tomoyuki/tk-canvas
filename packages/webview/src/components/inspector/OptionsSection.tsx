import {
  formatValue,
  getWidgetCatalog,
  parseOptionInput,
  type AnyNode,
  type Diagnostic,
  type JsonPath,
  type OptionInfo,
  type OptionValue,
} from '@tk-designer/core';
import { useState } from 'react';
import { createVariableFor } from '../../editing.ts';
import { useDocumentStore } from '../../store/stores.ts';
import { messagesAt } from './diagnostics.ts';
import { booleanOptions, enumOptions, SelectField, TextField, toBoolean } from './fields.tsx';

interface OptionsSectionProps {
  readonly node: AnyNode;
  readonly nodePath: JsonPath | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * オプションの編集。カタログの「よく使うオプション」と設定済みのオプションを表示し、「すべて表示」で残りも出す。
 */
export function OptionsSection({ node, nodePath, diagnostics }: OptionsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const widgetClass = getWidgetCatalog().classes.get(node.class);
  if (!widgetClass) return null;

  // コールバック（command 等）はイベント欄で編集する
  const all = [...widgetClass.options.values()]
    .filter((o) => o.type.kind !== 'callback')
    .map((o) => o.name)
    .sort();
  const common = (widgetClass.commonOptions.length > 0 ? widgetClass.commonOptions : all).filter(
    (n) => all.includes(n),
  );
  const set = Object.keys(node.options ?? {}).filter((name) => all.includes(name));
  const names = showAll
    ? [...common, ...all.filter((n) => !common.includes(n))]
    : unique([...common, ...set]);

  return (
    <section className="inspector-section">
      <h3>オプション</h3>
      {names.map((name) => {
        const info = widgetClass.options.get(name);
        if (!info) return null;
        return (
          <OptionField
            key={name}
            nodeId={node.id}
            info={info}
            value={node.options?.[name]}
            error={messagesAt(diagnostics, nodePath && [...nodePath, 'options', name])}
          />
        );
      })}
      <label className="inspector-toggle">
        <input
          type="checkbox"
          checked={showAll}
          onChange={(e) => {
            setShowAll(e.target.checked);
          }}
        />
        すべてのオプションを表示（{all.length}）
      </label>
    </section>
  );
}

interface OptionFieldProps {
  readonly nodeId: string;
  readonly info: OptionInfo;
  readonly value: OptionValue | undefined;
  readonly error: string | undefined;
}

function OptionField({ nodeId, info, value, error }: OptionFieldProps) {
  const variables = useDocumentStore((s) => s.document?.variables);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const set = (next: OptionValue | undefined) => {
    dispatch({ type: 'setOption', id: nodeId, name: info.name, value: next });
  };
  const defaultLabel = info.default === '' ? '空' : info.default;
  const label = info.creationOnly ? `${info.name} *` : info.name;
  const type = info.type;

  switch (type.kind) {
    case 'enum':
      return (
        <SelectField
          label={label}
          value={typeof value === 'string' ? value : ''}
          options={enumOptions(type.values, defaultLabel)}
          error={error}
          onChange={(v) => {
            set(v === '' ? undefined : v);
          }}
        />
      );
    case 'boolean':
      return (
        <SelectField
          label={label}
          value={typeof value === 'boolean' ? String(value) : ''}
          options={booleanOptions(defaultLabel)}
          error={error}
          onChange={(v) => {
            set(toBoolean(v));
          }}
        />
      );
    case 'variable': {
      const candidates = Object.entries(variables ?? {})
        .filter(([, v]) => type.variableTypes.includes(v.type))
        .map(([name, v]) => ({ value: name, label: `${name}（${v.type}）` }));
      const current = typeof value === 'object' && 'var' in value ? value.var : '';
      const [firstType = 'StringVar'] = type.variableTypes;
      return (
        <SelectField
          label={label}
          value={current}
          options={[
            {
              value: '',
              label:
                candidates.length > 0
                  ? '（なし）'
                  : `（${type.variableTypes.join(' / ')} の変数がありません）`,
            },
            ...candidates,
            { value: CREATE_VARIABLE, label: `＋ 新しい ${firstType} を作成` },
          ]}
          error={error}
          onChange={(v) => {
            if (v === CREATE_VARIABLE) {
              createVariableFor(nodeId, info.name, firstType);
              return;
            }
            set(v === '' ? undefined : { var: v });
          }}
        />
      );
    }
    default:
      return (
        <TextField
          label={label}
          value={formatValue(value)}
          placeholder={`既定: ${defaultLabel}`}
          error={error}
          onCommit={(text) => {
            const result = parseOptionInput(type, text);
            if (!result.ok) return result.error;
            set(result.value);
            return undefined;
          }}
        />
      );
  }
}

/** 変数の選択肢のうち「新しい変数を作成」を表す値（変数名として使えない文字を含める） */
const CREATE_VARIABLE = '<create>';

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
