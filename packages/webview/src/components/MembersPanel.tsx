import {
  collectHandlers,
  countVariableReferences,
  formatValue,
  memberNameProblem,
  parseInteger,
  parseNumber,
  VARIABLE_TYPES,
  type Variable,
  type VariableType,
} from '@tk-designer/core';
import { useState } from 'react';
import { addVariable } from '../editing.ts';
import { useDocumentStore, useUiStore } from '../store/stores.ts';
import { CompactInput } from './inspector/fields.tsx';

const SIGNATURE_LABELS = { none: '引数なし', value: '値', event: 'イベント' } as const;

/** 変数とハンドラの一覧。生成コードのクラスメンバになるもの（ウィジェット以外） */
export function MembersPanel() {
  const doc = useDocumentStore((s) => s.document);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const [newType, setNewType] = useState<VariableType>('StringVar');
  const hoverVariable = useUiStore((s) => s.hoverVariable);
  if (!doc) return null;

  const references = countVariableReferences(doc);
  const handlers = collectHandlers(doc);

  return (
    <section className="panel" aria-label="変数とハンドラ">
      <h2>変数</h2>
      <table className="members">
        <colgroup>
          <col className="members-name" />
          <col className="members-type" />
          <col />
          <col className="members-action" />
        </colgroup>
        <thead>
          <tr>
            <th>名前</th>
            <th>型</th>
            <th>初期値</th>
            <th aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {Object.entries(doc.variables ?? {}).map(([name, variable]) => (
            <tr
              key={name}
              // マウスを乗せると、この変数を参照しているウィジェットをキャンバスで強調する
              onMouseEnter={() => {
                hoverVariable(name);
              }}
              onMouseLeave={() => {
                hoverVariable(undefined);
              }}
            >
              <td>
                <CompactInput
                  label={`変数 ${name} の名前`}
                  value={name}
                  onCommit={(text) => {
                    const newName = text.trim();
                    const problem = memberNameProblem(newName);
                    if (problem) return problem;
                    dispatch({ type: 'renameVariable', name, newName });
                    return undefined;
                  }}
                />
              </td>
              <td>
                <select
                  aria-label={`変数 ${name} の型`}
                  value={variable.type}
                  onChange={(e) => {
                    // 型が変わると初期値の型も合わなくなるため、初期値は消す
                    dispatch({
                      type: 'setVariable',
                      name,
                      variable: { type: e.target.value as VariableType },
                    });
                  }}
                >
                  {VARIABLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/Var$/, '')}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <InitialValueInput
                  name={name}
                  variable={variable}
                  onChange={(next) => {
                    dispatch({ type: 'setVariable', name, variable: next });
                  }}
                />
              </td>
              <td>
                <button
                  type="button"
                  title={`削除（参照 ${String(references.get(name) ?? 0)} 箇所も解除されます）`}
                  aria-label={`変数 ${name} を削除`}
                  onClick={() => {
                    dispatch({ type: 'removeVariable', name });
                  }}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toolbar">
        <select
          aria-label="追加する変数の型"
          value={newType}
          onChange={(e) => {
            setNewType(e.target.value as VariableType);
          }}
        >
          {VARIABLE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            addVariable(newType);
          }}
        >
          ＋ 変数を追加
        </button>
      </div>

      <h2>ハンドラ</h2>
      {handlers.length === 0 ? (
        <p className="muted">command やイベントに設定したメソッドがここに表示されます</p>
      ) : (
        <table className="members">
          <colgroup>
            <col />
            <col className="members-type" />
            <col className="members-action" />
          </colgroup>
          <thead>
            <tr>
              <th>名前</th>
              <th>引数</th>
              <th>参照</th>
            </tr>
          </thead>
          <tbody>
            {handlers.map((h) => (
              <tr key={h.name}>
                <td>
                  <CompactInput
                    label={`ハンドラ ${h.name} の名前`}
                    value={h.name}
                    onCommit={(text) => {
                      const newName = text.trim();
                      const problem = memberNameProblem(newName);
                      if (problem) return problem;
                      dispatch({ type: 'renameHandler', name: h.name, newName });
                      return undefined;
                    }}
                  />
                </td>
                <td className={h.signatures.length > 1 ? 'error' : undefined}>
                  {h.signatures.map((s) => SIGNATURE_LABELS[s]).join(' / ')}
                </td>
                <td>{h.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {handlers.length > 0 && (
        <p className="inspector-note">名前を変えると、参照しているすべての箇所に反映されます。</p>
      )}
    </section>
  );
}

/** 変数の初期値。型に合わせて入力方法を変える（空欄 = 初期値なし） */
function InitialValueInput({
  name,
  variable,
  onChange,
}: {
  readonly name: string;
  readonly variable: Variable;
  readonly onChange: (variable: Variable) => void;
}) {
  const label = `変数 ${name} の初期値`;
  if (variable.type === 'BooleanVar') {
    return (
      <select
        aria-label={label}
        value={variable.value === undefined ? '' : String(variable.value)}
        onChange={(e) => {
          const v = e.target.value;
          onChange({ type: 'BooleanVar', value: v === '' ? undefined : v === 'true' });
        }}
      >
        <option value="">（なし）</option>
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }
  return (
    <CompactInput
      label={label}
      value={formatValue(variable.value)}
      onCommit={(text) => {
        switch (variable.type) {
          case 'StringVar':
            onChange({ type: 'StringVar', value: text === '' ? undefined : text });
            return undefined;
          case 'IntVar': {
            const result = parseInteger(text);
            if (!result.ok) return result.error;
            onChange({ type: 'IntVar', value: result.value });
            return undefined;
          }
          case 'DoubleVar': {
            const result = parseNumber(text);
            if (!result.ok) return result.error;
            onChange({ type: 'DoubleVar', value: result.value });
            return undefined;
          }
        }
      }}
    />
  );
}
