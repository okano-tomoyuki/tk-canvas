import { Inspector } from './components/Inspector.tsx';
import { Palette } from './components/Palette.tsx';
import { StatusPanel } from './components/StatusPanel.tsx';
import { WidgetTree } from './components/WidgetTree.tsx';
import { useDocumentStore } from './store/stores.ts';

export function App() {
  const status = useDocumentStore((s) => s.status);
  const hasDocument = useDocumentStore((s) => s.document !== undefined);

  if (status === 'loading') return <p>読み込み中…</p>;
  if (!hasDocument) {
    return (
      <main>
        <p>
          ファイルの内容が不正なため、デザイナーを表示できません。テキストエディタで修正してください。
        </p>
        <StatusPanel />
      </main>
    );
  }
  return (
    <main className="layout">
      <Palette />
      <WidgetTree />
      <Inspector />
      <StatusPanel />
    </main>
  );
}
