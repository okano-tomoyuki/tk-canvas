import { Widget } from "./widget/widget";
import { DesignerCanvas } from "./designer_canvas";

export class WidgetTree {
  private container: HTMLElement;
  private canvas: DesignerCanvas;

  constructor(container: HTMLElement, canvas: DesignerCanvas) {
    this.container = container;
    this.canvas = canvas;
  }

  // -----------------------------
  // ツリー全体を再描画
  // -----------------------------
  public refresh() {
    this.container.innerHTML = "";
    const ul = document.createElement("ul");
    ul.style.listStyle = "none";
    ul.style.paddingLeft = "12px";

    for (const w of this.canvas.widgets) {
      ul.appendChild(this.createNode(w));
    }

    this.container.appendChild(ul);
  }

  // -----------------------------
  // 単一ノード（Widget）を作成
  // -----------------------------
  private createNode(widget: Widget): HTMLElement {
    const li = document.createElement("li");
    li.style.cursor = "pointer";
    li.style.margin = "4px 0";

    // 表示名
    const label = document.createElement("span");
    label.textContent = widget.constructor.name;
    // label.style.font
    label.style.padding = "2px 4px";
    label.style.borderRadius = "4px";

    // 選択中ならハイライト
    if (widget.isSelected()) {
      label.style.background = "#0078d4";
      label.style.color = "white";
    }

    // クリックで DesignerCanvas 側の選択を同期
    label.onclick = () => {
      this.canvas.selectWidgetFromTree(widget);
      this.refresh();
    };

    li.appendChild(label);

    // 子がいる場合は再帰的に UL を作成
    if (widget.children.length > 0) {
      const ul = document.createElement("ul");
      ul.style.listStyle = "none";
      ul.style.paddingLeft = "16px";

      for (const child of widget.children) {
        ul.appendChild(this.createNode(child));
      }

      li.appendChild(ul);
    }

    return li;
  }
}
