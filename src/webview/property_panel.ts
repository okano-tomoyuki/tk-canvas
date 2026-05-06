import { Widget } from "./widget/widget";
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
        this.canvas?.render();
      });

      row.appendChild(label);
      row.appendChild(input);
      this.container.appendChild(row);
    }
  }

  // ★ prop.type を見て input を生成する
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

      case "color":
        return (input as HTMLInputElement).value;

      case "enum":
        return (input as HTMLSelectElement).value;

      default:
        return (input as HTMLInputElement).value;
    }
  }
}
