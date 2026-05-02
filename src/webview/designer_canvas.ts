import { Widget } from "./widget/widget";
import { RectangleWidget } from "./widget/rectangle_widget";
import { LabelWidget } from "./widget/label_widget";
import { ButtonWidget } from "./widget/button_widget";
import { CheckBoxWidget } from "./widget/checkbox_widget";
import { TextFieldWidget } from "./widget/textfield_widget";
import { PropertyPanel } from "./property_panel";

export class DesignerCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private offscreen: HTMLCanvasElement;
  private offctx: CanvasRenderingContext2D;

  private widgets: Widget[] = [];
  private selectedItems: Widget[] = [];

  private propertyPanel: PropertyPanel | null = null;

  private prevX = 0;
  private prevY = 0;

  private isDragging : boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    // 裏バッファ
    this.offscreen = document.createElement("canvas");
    this.offctx = this.offscreen.getContext("2d")!;

    this.resize();

    // --- 初期ウィジェット ---
    this.widgets.push(new RectangleWidget(50, 50, 100, 80));
    this.widgets.push(new RectangleWidget(200, 120, 120, 90));

    this.widgets.push(new LabelWidget(50, 200));
    this.widgets.push(new ButtonWidget(200, 200, 120, 40));
    this.widgets.push(new CheckBoxWidget(50, 260));
    this.widgets.push(new TextFieldWidget(200, 260));

    // --- イベント ---
    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
  }

  public addWidget(type: string) {
      let w: Widget | null = null;

      switch (type) {
          case "rectangle":
              w = new RectangleWidget(50, 50, 100, 80);
              break;
          case "label":
              w = new LabelWidget(50, 50);
              break;
          case "button":
              w = new ButtonWidget(50, 50, 120, 40);
              break;
          case "checkbox":
              w = new CheckBoxWidget(50, 50);
              break;
          case "textfield":
              w = new TextFieldWidget(50, 50);
              break;
      }

      if (w) {
          this.widgets.push(w);
          this.render();
      }
  }


  // -----------------------------
  // レンダリング
  // -----------------------------
  public render() {
    this.drawToOffscreen();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.offscreen, 0, 0);
  }

  private drawToOffscreen() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.offctx.clearRect(0, 0, w, h);
    this.offctx.fillStyle = "white";
    this.offctx.fillRect(0, 0, w, h);

    for (const widget of this.widgets) {
      widget.paint(this.offctx);
    }
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    this.canvas.width = w;
    this.canvas.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.render();
  }

  public setPropertyPanel(panel: PropertyPanel) {
    this.propertyPanel = panel;
  }

  // -----------------------------
  // マウス処理
  // -----------------------------
  private onMouseDown(e: MouseEvent) {
    const x = e.offsetX;
    const y = e.offsetY;

    this.prevX = x;
    this.prevY = y;

    let hit: Widget | null = null;

    for (const w of this.widgets) {
      if (w.contains(x, y)) {
        hit = w;
        break;
      }
    }

    if (hit) {
      this.isDragging = true;
      this.selectedItems = [hit];
      hit.setSelected(true);

      if (this.propertyPanel) {
        this.propertyPanel.setWidget(hit);
      }
    } else {
      this.isDragging = false;
      for (const w of this.widgets) {
        w.setSelected(false);
      }
      this.selectedItems = [];

      if (this.propertyPanel) {
        this.propertyPanel.setWidget(null);
      }
    }

    this.render();
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging) {
      return;
    }

    if (this.selectedItems.length === 0) {
      return;
    }

    const x = e.offsetX;
    const y = e.offsetY;

    const dx = x - this.prevX;
    const dy = y - this.prevY;

    this.prevX = x;
    this.prevY = y;

    for (const w of this.selectedItems) {
      w.move(dx, dy);
    }

    if (this.propertyPanel) {
      this.propertyPanel.setWidget(this.selectedItems[0]);
    }

    this.render();
  }

  private onMouseUp(e: MouseEvent) {
    this.isDragging = false;
    for (const w of this.widgets) {
      w.setSelected(false);
    }
    this.render();
  }
}

