import { Widget } from "./widget/widget";
import { DesignerCanvas } from "./designer_canvas";

export class PropertyPanel {
  private container: HTMLElement;
  private current: Widget | null = null;
  private canvas: DesignerCanvas | null = null;

  constructor() {
    this.container = document.getElementById("property-panel") as HTMLElement;
  }

  setCanvas(canvas: DesignerCanvas) {
    this.canvas = canvas;
  }

  setWidget(widget: Widget | null) {
    this.current = widget;
    this.container.innerHTML = "";

    if (!widget) {
      return;
    }

    const props = widget.getProps();

    for (const key of Object.keys(props)) {
      const value = props[key];
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("label");
      label.textContent = key;
      const input = this.createInput(key, value);
      input.addEventListener("input", () => {
        const newValue = this.parseValue(input, value);
        widget.setProps(key, newValue);
        this.canvas?.render();
      });

      row.appendChild(label);
      row.appendChild(input);
      this.container.appendChild(row);
    }
  }

  private createInput(key:string, value:any): HTMLInputElement {
    const input = document.createElement("input");
    if (typeof value === "number") {
      input.type = "number";
      input.value = String(value);
    } else if (typeof value === "boolean") {
      input.type = "checkbox";
      input.checked = value;
    } else {
      input.type = "text";
      input.value = String(value);
    }

    return input;
  }

  private parseValue(input : HTMLInputElement, original : any) :any {
    if (typeof original === "number") {
      return Number(input.value);
    }
    if (typeof original === "boolean") {
      return input.checked;
    }
    return input.value;
  }
}
