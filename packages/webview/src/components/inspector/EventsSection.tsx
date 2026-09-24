import {
  collectHandlers,
  getWidgetCatalog,
  isValidIdentifier,
  type AnyNode,
  type Binding,
  type Diagnostic,
  type HandlerSignature,
  type JsonPath,
} from '@tk-designer/core';
import { useId } from 'react';
import { addBinding } from '../../editing.ts';
import { useDocumentStore } from '../../store/stores.ts';
import { messagesAt } from './diagnostics.ts';
import { CompactInput, TextField } from './fields.tsx';

const SIGNATURE_HINTS: Readonly<Record<HandlerSignature, string>> = {
  none: '引数なしで呼ばれる',
  value: '現在値を受け取る',
  event: 'イベントを受け取る',
};

interface EventsSectionProps {
  readonly node: AnyNode;
  readonly nodePath: JsonPath | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

/**
 * イベントの編集（docs/dsl-design-notes.md「イベントの扱い」）。
 * command（そのクラスが持つ場合）と bind を並べて編集する。
 */
export function EventsSection({ node, nodePath, diagnostics }: EventsSectionProps) {
  const doc = useDocumentStore((s) => s.document);
  const dispatch = useDocumentStore((s) => s.dispatch);
  const handlerListId = useId();
  const sequenceListId = useId();
  const widgetClass = getWidgetCatalog().classes.get(node.class);
  if (!widgetClass || !doc) return null;

  // シグネチャが定義されているコールバック（command 等）だけを編集できる
  const callbacks = [...widgetClass.options.values()].filter(
    (o) => o.type.kind === 'callback' && o.type.signature !== undefined,
  );
  const bindings = node.bindings ?? [];
  const setBindings = (next: readonly Binding[]) => {
    dispatch({ type: 'setBindings', id: node.id, bindings: next });
  };
  const validateName = (text: string) =>
    isValidIdentifier(text.trim()) ? 'メソッド名として使えない名前です' : undefined;

  return (
    <section className="inspector-section">
      <h3>イベント</h3>
      {/* 既存のハンドラ名とイベントの候補（入力補完） */}
      <datalist id={handlerListId}>
        {collectHandlers(doc).map((h) => (
          <option key={h.name} value={h.name} />
        ))}
      </datalist>
      <datalist id={sequenceListId}>
        {widgetClass.events.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>

      {callbacks.map((option) => {
        const value = node.options?.[option.name];
        const current = typeof value === 'object' && 'handler' in value ? value.handler : '';
        const signature = option.type.kind === 'callback' ? option.type.signature : undefined;
        return (
          <TextField
            key={option.name}
            label={option.name}
            value={current}
            placeholder={signature ? `メソッド名（${SIGNATURE_HINTS[signature]}）` : 'メソッド名'}
            list={handlerListId}
            error={messagesAt(diagnostics, nodePath && [...nodePath, 'options', option.name])}
            onCommit={(text) => {
              const name = text.trim();
              if (name !== '' && validateName(name)) return validateName(name);
              dispatch({
                type: 'setOption',
                id: node.id,
                name: option.name,
                value: name === '' ? undefined : { handler: name },
              });
              return undefined;
            }}
          />
        );
      })}

      <h4>bind（{SIGNATURE_HINTS.event}）</h4>
      {bindings.length > 0 && (
        <table className="bindings">
          <thead>
            <tr>
              <th>シーケンス</th>
              <th>メソッド名</th>
              <th aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {bindings.map((binding, index) => {
              const replace = (patch: Partial<Binding>) => {
                setBindings(bindings.map((b, i) => (i === index ? { ...b, ...patch } : b)));
              };
              const errorAt = (key: string) =>
                messagesAt(diagnostics, nodePath && [...nodePath, 'bindings', index, key]);
              return (
                // 並べ替えは行わないため、位置をキーにしてよい
                <tr key={index}>
                  <td>
                    <CompactInput
                      label={`${String(index + 1)} 番目のシーケンス`}
                      value={binding.sequence}
                      list={sequenceListId}
                      error={errorAt('sequence')}
                      onCommit={(text) => {
                        const sequence = text.trim();
                        if (!/^<.+>$/.test(sequence))
                          return '"<Return>" や "<<ComboboxSelected>>" の形式で入力してください';
                        replace({ sequence });
                        return undefined;
                      }}
                    />
                  </td>
                  <td>
                    <CompactInput
                      label={`${String(index + 1)} 番目のメソッド名`}
                      value={binding.handler}
                      list={handlerListId}
                      error={errorAt('handler')}
                      onCommit={(text) => {
                        const error = validateName(text);
                        if (error) return error;
                        replace({ handler: text.trim() });
                        return undefined;
                      }}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label={`${binding.sequence} の bind を削除`}
                      onClick={() => {
                        setBindings(bindings.filter((_, i) => i !== index));
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <button
        type="button"
        onClick={() => {
          addBinding(node.id);
        }}
      >
        ＋ bind を追加
      </button>
    </section>
  );
}
