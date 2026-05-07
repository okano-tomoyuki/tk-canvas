import { DesignerCanvas } from "./designer_canvas";
import { PropertyPanel } from "./property_panel";
import { WidgetTree } from "./widget_tree";

declare function acquireVsCodeApi(): {
  postMessage(msg: any): void;
  getState(): any;
  setState(state: any): void;
};

window.addEventListener("DOMContentLoaded", () => {
  // --- HTML 要素取得 ---
  const canvas = document.getElementById("designer-canvas") as HTMLCanvasElement;
  const panelElement = document.getElementById("property-panel");
  const treeElement = document.getElementById("widget-tree") as HTMLElement;

  if (!canvas || !panelElement) {
    console.error("Canvas または PropertyPanel の HTML が見つかりません");
    return;
  }

  const designer = new DesignerCanvas(canvas);
  const propertyPanel = new PropertyPanel(panelElement, designer);
  const widgetTree = new WidgetTree(treeElement, designer);

  // DesignerCanvas → PropertyPanel への通知を有効化
  designer.setPropertyPanel(propertyPanel);
  designer.setTreeView(widgetTree);

  // Widget追加ボタン
  document.querySelectorAll("#toolbar button").forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-widget");
      designer.addWidget(type!);
    });
  });

  // 保存ボタン
  const vscode = acquireVsCodeApi();
  const saveButton = document.getElementById("save-button");
  saveButton?.addEventListener("click", () => {
    const json = designer.save();   // ← DesignerCanvas の save() を呼ぶ
    vscode.postMessage({ type: "save-json", data: json });
  });

  // 読込（Webview → Extension）
  document.getElementById("load-button")?.addEventListener("click", () => {
    vscode.postMessage({ type: "request-load" });
  });

  // 読込（Extension → Webview）
  window.addEventListener("message", event => {
    const msg = event.data;

    if (msg.type === "load-json") {
      const jsonString = msg.data;
      designer.load(jsonString);
    }
  });

  // 初回描画
  designer.render();
});
