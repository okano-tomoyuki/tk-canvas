import { Widget } from "./widget/widget";
import { DesignerCanvas } from "./designer_canvas";

export class PropertyPanel {
  private xField: HTMLInputElement;
  private yField: HTMLInputElement;
  private wField: HTMLInputElement;
  private hField: HTMLInputElement;

  private current: Widget | null = null;
  private canvas: DesignerCanvas | null = null;

  constructor() {
    this.xField = document.getElementById("prop-x") as HTMLInputElement;
    this.yField = document.getElementById("prop-y") as HTMLInputElement;
    this.wField = document.getElementById("prop-w") as HTMLInputElement;
    this.hField = document.getElementById("prop-h") as HTMLInputElement;

    // 値変更イベント（Java の addActionListener と同じ）
    this.xField.addEventListener("change", () => this.updateWidget());
    this.yField.addEventListener("change", () => this.updateWidget());
    this.wField.addEventListener("change", () => this.updateWidget());
    this.hField.addEventListener("change", () => this.updateWidget());
  }

  setCanvas(canvas: DesignerCanvas) {
    this.canvas = canvas;
  }

  setWidget(w: Widget | null) {
    this.current = w;

    if (w) {
      this.xField.value = String(w.getX());
      this.yField.value = String(w.getY());
      this.wField.value = String(w.getWidth());
      this.hField.value = String(w.getHeight());
    } else {
      this.xField.value = "";
      this.yField.value = "";
      this.wField.value = "";
      this.hField.value = "";
    }
  }

  private updateWidget() {
    if (!this.current) {
      return;
    }

    const x = parseInt(this.xField.value);
    const y = parseInt(this.yField.value);
    const w = parseInt(this.wField.value);
    const h = parseInt(this.hField.value);

    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(w) || Number.isNaN(h)) {
      return;
    }

    // Java と同じ：Widget の値を直接更新
    this.current.x = x;
    this.current.y = y;
    this.current.width = w;
    this.current.height = h;

    // Canvas に再描画を依頼（Java の createBuffer + repaint）
    if (this.canvas) {
      this.canvas.render();
    }
  }
}
