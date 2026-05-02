import { DesignerCanvas } from "./designer_canvas";
import { PropertyPanel } from "./property_panel";

window.addEventListener("DOMContentLoaded", () => {
  // --- HTML 要素取得 ---
  const canvas = document.getElementById("designer-canvas") as HTMLCanvasElement;
  const panelElement = document.getElementById("property-panel");

  if (!canvas || !panelElement) {
    console.error("Canvas または PropertyPanel の HTML が見つかりません");
    return;
  }

  // --- DesignerCanvas 作成 ---
  const designer = new DesignerCanvas(canvas);

  // --- PropertyPanel 作成 ---
  const propertyPanel = new PropertyPanel();

  // PropertyPanel は HTML 内の input を使うので、HTML 側に panelElement が必要
  propertyPanel.setCanvas(designer);

  // DesignerCanvas → PropertyPanel への通知を有効化
  designer.setPropertyPanel(propertyPanel);

  // 初回描画
  designer.render();
});
