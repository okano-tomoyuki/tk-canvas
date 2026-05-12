import { Widget } from "./widget/widget";
import { Radiobutton } from "./widget/radiobutton";
import { Notebook } from "./widget/notebook";
import { DesignerCanvas } from "./designer_canvas";

export class PropertyPanel {
  private container: HTMLElement;
  private current: Widget | null = null;
  private canvas: DesignerCanvas | null = null;

  constructor(container: HTMLElement, canvas: DesignerCanvas) {
    this.container = container;
    this.canvas = canvas;
  }

  setWidget(widget: Widget | null) {
    this.current = widget;
    this.container.innerHTML = "";

    if (!widget) {
      return;
    }

    const props = widget.getProperties();

    for (const prop of props) {
      const row = document.createElement("div");
      row.className = "row";

      const label = document.createElement("label");
      label.textContent = prop.key;

      const input = this.createInput(prop);

      input.addEventListener("input", () => {
        const newValue = this.parseValue(input, prop);
        widget.setProperty(prop.key, newValue);
        this.handlePropertyChanged(widget, prop.key, newValue);
        this.canvas?.render();
      });

      row.appendChild(label);
      row.appendChild(input);
      this.container.appendChild(row);
    }
  }

  private handlePropertyChanged(widget: Widget, key: string, value: any): void {

    // Radiobutton の排他制御
    if (widget instanceof Radiobutton) {
      const group = widget.group;

      const uncheckGroup = (widgets: Widget[]) => {
        if (widget.checked === true) {
          for (const w of widgets) {
            if (w instanceof Radiobutton && w.group === group && w !== widget) {
              w.checked = false;
            }
            uncheckGroup(w.children);
          }
        }
      };

      if (this.canvas) {
        uncheckGroup(this.canvas.widgets);
        this.canvas.render();
      }
    }

    // Checkbox の ON/OFF は単純なので特に処理不要
    // Notebook のタブ切り替えなどはここに追加予定
    if (widget instanceof Notebook && key === "tabNames") {
      const newNames = value as string[];
      const oldNames = widget.tabNames;

      // --- ページ追加 ---
      if (newNames.length > oldNames.length) {
        for (let i = oldNames.length; i < newNames.length; i++) {
          widget.addPage(newNames[i]);
        }
      }

      // --- ページ削除 ---
      if (newNames.length < oldNames.length) {
        for (let i = newNames.length; i < oldNames.length; i++) {
          widget.removePage(newNames.length); // 後ろから削除
        }
      }

      // --- 名前更新 ---
      widget.tabNames = newNames;

      this.canvas?.render();
    }
  }

  // prop.type を見て input を生成する
  private createInput(prop: any): HTMLElement {
    let input: HTMLElement;

    switch (prop.type) {
      case "number":
        input = document.createElement("input");
        (input as HTMLInputElement).type = "number";
        (input as HTMLInputElement).value = String(prop.value);
        break;

      case "boolean":
        input = document.createElement("input");
        (input as HTMLInputElement).type = "checkbox";
        (input as HTMLInputElement).checked = prop.value;
        break;

      case "list":
        input = document.createElement("textarea");
        (input as HTMLTextAreaElement).value = prop.value.join("\n");
        (input as HTMLTextAreaElement).rows = 4;
        break;

      case "color":
        input = document.createElement("input");
        (input as HTMLInputElement).type = "color";
        (input as HTMLInputElement).value = prop.value;
        break;

      case "enum":
        input = document.createElement("select");
        for (const opt of prop.options ?? []) {
          const option = document.createElement("option");
          option.value = opt;
          option.textContent = opt;
          if (opt === prop.value) {
            option.selected = true;
          }
          (input as HTMLSelectElement).appendChild(option);
        }
        break;

      default:
        // string その他
        input = document.createElement("input");
        (input as HTMLInputElement).type = "text";
        (input as HTMLInputElement).value = String(prop.value);
        break;
    }

    return input;
  }

  // ★ prop.type に応じて値を取り出す
  private parseValue(input: HTMLElement, prop: any): any {
    switch (prop.type) {
      case "number":
        return Number((input as HTMLInputElement).value);

      case "boolean":
        return (input as HTMLInputElement).checked;

      case "list":
        return (input as HTMLTextAreaElement).value
          .split("\n")
          .map(s => s.trim())
          .filter(s => s.length > 0);

      case "color":
        return (input as HTMLInputElement).value;

      case "enum":
        return (input as HTMLSelectElement).value;

      default:
        return (input as HTMLInputElement).value;
    }
  }
}
