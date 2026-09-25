/**
 * 新しい画面（*.tkui.json）の初期内容。ルートのクラス（生成されるクラスの基底クラス。docs/adr/0011）を選んで作る。
 */
import { FORMAT_VERSION, isWindowClass, type RootClass, type TkuiDocument } from '../dsl/schema.ts';
import { isValidIdentifier } from '../identifier.ts';
import { defaultLayout } from './defaults.ts';

/**
 * @param name 画面の名前（ファイル名から拡張子を除いたもの）。ルートの id とウィンドウのタイトルに使う
 */
export function createDocument(rootClass: RootClass, name: string): TkuiDocument {
  const layout = defaultLayout(rootClass);
  return {
    formatVersion: FORMAT_VERSION,
    root: {
      id: rootIdOf(name),
      class: rootClass,
      ...(isWindowClass(rootClass) && { window: { title: name } }),
      ...(layout && { layout }),
    },
  };
}

/** 名前を識別子にする（使えない文字は _ に置き換え、使えなければ "root"） */
function rootIdOf(name: string): string {
  const id = name.replace(/[^A-Za-z0-9_]/g, '_').replace(/^(?=[0-9])/, '_');
  return isValidIdentifier(id) ? 'root' : id;
}
