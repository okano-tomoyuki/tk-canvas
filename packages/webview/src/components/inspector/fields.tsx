/**
 * プロパティエディタの入力部品。
 * - 文字入力は Enter またはフォーカスを外したときに確定する（1回の確定 = Undo 1回）。Esc で元に戻す。
 * - 選択肢・チェックは変更した時点で確定する。
 * - 空欄は「値を書かない（Tk の既定値）」を表す。
 */
import { useId, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';

interface FieldRowProps {
  readonly label: string;
  readonly htmlFor?: string;
  readonly error?: string | undefined;
  readonly children: ReactNode;
}

export function FieldRow({ label, htmlFor, error, children }: FieldRowProps) {
  return (
    <div className={error ? 'field-row has-error' : 'field-row'}>
      <label htmlFor={htmlFor}>{label}</label>
      <div className="field-control">
        {children}
        {error && (
          <div className="field-error" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

interface TextFieldProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  /** 検証（診断）によるエラー */
  readonly error?: string | undefined;
  /** 確定時に呼ばれる。入力が不正ならエラーメッセージを返す（確定しない） */
  readonly onCommit: (text: string) => string | undefined;
}

/**
 * 入力中の内容（draft）と確定処理。外部（Undo・テキストエディタでの編集など）で値が変わったら、入力中の内容を捨てて追従する。
 */
function useCommittedDraft(value: string, onCommit: (text: string) => string | undefined) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string>();
  const [shownValue, setShownValue] = useState(value);
  if (value !== shownValue) {
    setShownValue(value);
    setDraft(value);
    setError(undefined);
  }
  const commit = () => {
    if (draft === value) {
      setError(undefined);
      return;
    }
    setError(onCommit(draft));
  };
  const inputProps = {
    value: draft,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      setDraft(e.target.value);
    },
    onBlur: commit,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') commit();
      if (e.key === 'Escape') {
        setDraft(value);
        setError(undefined);
      }
    },
  };
  return { error, inputProps };
}

export function TextField({ label, value, placeholder, error, onCommit }: TextFieldProps) {
  const id = useId();
  const draft = useCommittedDraft(value, onCommit);
  return (
    <FieldRow label={label} htmlFor={id} error={draft.error ?? error}>
      <input id={id} placeholder={placeholder} {...draft.inputProps} />
    </FieldRow>
  );
}

interface CompactInputProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly error?: string | undefined;
  readonly onCommit: (text: string) => string | undefined;
}

/** 表の中などで使う、見出しのない入力欄。エラーは枠の色とツールチップで示す */
export function CompactInput({ label, value, placeholder, error, onCommit }: CompactInputProps) {
  const draft = useCommittedDraft(value, onCommit);
  const message = draft.error ?? error;
  return (
    <input
      aria-label={label}
      aria-invalid={message !== undefined}
      title={message}
      className={message ? 'compact-input has-error' : 'compact-input'}
      placeholder={placeholder}
      {...draft.inputProps}
    />
  );
}

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface SelectFieldProps {
  readonly label: string;
  readonly value: string;
  readonly options: readonly SelectOption[];
  readonly error?: string | undefined;
  readonly disabled?: boolean;
  readonly onChange: (value: string) => void;
}

export function SelectField({
  label,
  value,
  options,
  error,
  disabled,
  onChange,
}: SelectFieldProps) {
  const id = useId();
  // 現在の値が候補にない場合（手で書かれた不正な値など）も、値を失わないよう選択肢に加える
  const all = options.some((o) => o.value === value)
    ? options
    : [...options, { value, label: value }];
  return (
    <FieldRow label={label} htmlFor={id} error={error}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
        }}
      >
        {all.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

/** 真偽値の選択肢（未設定 = Tk の既定値） */
export function booleanOptions(defaultLabel: string): SelectOption[] {
  return [
    { value: '', label: `既定（${defaultLabel}）` },
    { value: 'true', label: 'true' },
    { value: 'false', label: 'false' },
  ];
}

/** 列挙値の選択肢（未設定 = Tk の既定値） */
export function enumOptions(values: readonly string[], defaultLabel: string): SelectOption[] {
  return [
    { value: '', label: `既定（${defaultLabel}）` },
    ...values.map((v) => ({ value: v, label: v })),
  ];
}

export function toBoolean(value: string): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
