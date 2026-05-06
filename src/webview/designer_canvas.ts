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

  private isDragging: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    // 裏バッファ
    this.offscreen = document.createElement("canvas");
    this.offctx = this.offscreen.getContext("2d")!;
    this.resize();

    this.widgets.push(new RectangleWidget({ x: 50, y: 50, width: 100, height: 80 }));
    this.widgets.push(new RectangleWidget({ x: 200, y: 120, width: 120, height: 90 }));
    this.widgets.push(new LabelWidget({ x: 50, y: 200 }));
    this.widgets.push(new ButtonWidget({ x: 200, y: 200, width: 120, height: 40 }));
    this.widgets.push(new CheckBoxWidget({ x: 50, y: 260 }));
    this.widgets.push(new TextFieldWidget({ x: 200, y: 260 }));

    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
  }

  public addWidget(type: string) {
    let w: Widget | null = null;

    switch (type) {
      case "rectangle":
        w = new RectangleWidget({ x: 50, y: 50, width: 100, height: 80 });
        break;
      case "label":
        w = new LabelWidget({ x: 50, y: 50 });
        break;
      case "button":
        w = new ButtonWidget({ x: 50, y: 50, width: 120, height: 40 });
        break;
      case "checkbox":
        w = new CheckBoxWidget({ x: 50, y: 50 });
        break;
      case "textfield":
        w = new TextFieldWidget({ x: 50, y: 50 });
        break;
    }

    if (w) {
      this.widgets.push(w);
      this.render();
    }
  }

  public save(){
    return this.widgets.map(w => this.serializeWidget(w));
    // return JSON.stringify(data, null, 2);
  }

  public load(json: string) {
    const list: any[] = JSON.parse(json);
    this.widgets = list.map(item => this.createWidget(item.type, item.props));
    this.render();
  }

  private serializeWidget(widget: Widget): any {
    return {
      type: widget.constructor.name,
      props: this.extractProps(widget),
      // children: widget.children.map(c => this.serializeWidget(c))
    };
  }

  private extractProps(widget: Widget): Record<string, any> {
    const props: Record<string, any> = {};
    for (const p of widget.getProperties()) {
      props[p.key] = p.value;
    }
    return props;
  }

  private createWidget(type: string, props: Record<string, any>): Widget {
    switch (type) {
      case "RectangleWidget": return new RectangleWidget(props);
      case "LabelWidget": return new LabelWidget(props);
      case "ButtonWidget": return new ButtonWidget(props);
      case "CheckBoxWidget": return new CheckBoxWidget(props);
      case "TextFieldWidget": return new TextFieldWidget(props);
    }
    throw new Error("Unknown widget type: " + type);
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

