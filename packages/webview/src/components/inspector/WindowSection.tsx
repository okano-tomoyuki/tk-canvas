import { parseNumberList, type Diagnostic, type WindowSettings } from '@tk-designer/core';
import { useDocumentStore } from '../../store/stores.ts';
import { messagesAt } from './diagnostics.ts';
import { booleanOptions, SelectField, TextField, toBoolean } from './fields.tsx';

const GEOMETRY = /^(?=.)(\d+x\d+)?([+-]\d+[+-]\d+)?$/;

interface WindowSectionProps {
  readonly window: WindowSettings | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

/** ルートウィンドウの wm 系の設定（title, geometry, resizable, minsize, maxsize） */
export function WindowSection({ window = {}, diagnostics }: WindowSectionProps) {
  const dispatch = useDocumentStore((s) => s.dispatch);
  const update = (patch: Partial<WindowSettings>) => {
    dispatch({ type: 'setWindow', window: { ...window, ...patch } });
  };
  const errorAt = (key: string) => messagesAt(diagnostics, ['root', 'window', key]);
  const [resizableX, resizableY] = window.resizable ?? [undefined, undefined];

  const setResizable = (index: 0 | 1, value: boolean | undefined) => {
    const next: [boolean | undefined, boolean | undefined] = [resizableX, resizableY];
    next[index] = value;
    // どちらも未設定なら項目ごと削除する（Tk の既定はどちらも true）
    update({
      resizable:
        next[0] === undefined && next[1] === undefined
          ? undefined
          : [next[0] ?? true, next[1] ?? true],
    });
  };

  const sizeField = (key: 'minsize' | 'maxsize', label: string) => (
    <TextField
      label={key}
      value={window[key]?.join(' ') ?? ''}
      placeholder={label}
      error={errorAt(key)}
      onCommit={(text) => {
        const result = parseNumberList(text, [2]);
        if (!result.ok) return '"幅 高さ" の形式で入力してください';
        update({ [key]: result.value as [number, number] | undefined });
        return undefined;
      }}
    />
  );

  return (
    <section className="inspector-section">
      <h3>ウィンドウ</h3>
      <TextField
        label="title"
        value={window.title ?? ''}
        placeholder="既定: tk"
        error={errorAt('title')}
        onCommit={(text) => {
          update({ title: text === '' ? undefined : text });
          return undefined;
        }}
      />
      <TextField
        label="geometry"
        value={window.geometry ?? ''}
        placeholder="例: 400x300"
        error={errorAt('geometry')}
        onCommit={(text) => {
          const value = text.trim();
          if (value !== '' && !GEOMETRY.test(value))
            return '"400x300" や "400x300+100+50" の形式で入力してください';
          update({ geometry: value === '' ? undefined : value });
          return undefined;
        }}
      />
      <SelectField
        label="resizable（幅）"
        value={resizableX === undefined ? '' : String(resizableX)}
        options={booleanOptions('true')}
        error={errorAt('resizable')}
        onChange={(v) => {
          setResizable(0, toBoolean(v));
        }}
      />
      <SelectField
        label="resizable（高さ）"
        value={resizableY === undefined ? '' : String(resizableY)}
        options={booleanOptions('true')}
        onChange={(v) => {
          setResizable(1, toBoolean(v));
        }}
      />
      {sizeField('minsize', '例: 200 100')}
      {sizeField('maxsize', '例: 800 600')}
    </section>
  );
}
