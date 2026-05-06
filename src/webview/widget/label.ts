import { Property } from "./property";
import { Widget } from "./widget";

export class Label extends Widget {
  caption: string = "Label";

  constructor(props?: Record<string, any>) {
    super();
    this.width = 80;
    this.height = 20;
    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 絶対座標を取得 ---
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";

    const metrics = ctx.measureText(this.caption);
    const ascent = metrics.actualBoundingBoxAscent ?? 12;

    // --- テキスト描画（絶対座標）---
    ctx.fillText(this.caption, ax, ay + ascent);

    // --- 選択枠（絶対座標）---
    if (this.selected) {
      ctx.strokeStyle = "rgb(0, 120, 215)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        ax - 2,
        ay - 2,
        this.width + 4,
        this.height + 4
      );
    }
  }

  getProperties(): Property<any>[] {
    return [
      new Property("enable", "boolean", this.enable),
      new Property("visible", "boolean", this.visible),
      new Property("x", "number", this.x),
      new Property("y", "number", this.y),
      new Property("width", "number", this.width),
      new Property("height", "number", this.height),
      new Property("caption", "string", this.caption),
    ];
  }
}
