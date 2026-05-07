import { Property } from "./property";
import { Widget } from "./widget";

export class Button extends Widget {
  caption: string = "Button";
  fill: string = "#D3D3D3";
  borderStyle: string = "solid";

  constructor(props?: Record<string, any>) {
    super();
    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 絶対座標を取得 ---
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    // --- 背景 ---
    ctx.fillStyle = this.fill;
    ctx.fillRect(ax, ay, this.width, this.height);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, ay, this.width, this.height);

    // --- テキスト（中央寄せ）---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";

    const metrics = ctx.measureText(this.caption);
    const textWidth = metrics.width;
    const textHeight = metrics.actualBoundingBoxAscent ?? 12;

    const tx = ax + (this.width - textWidth) / 2;
    const ty = ay + (this.height + textHeight) / 2 - 2;

    ctx.fillText(this.caption, tx, ty);
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
      new Property("fill", "color", this.fill),
      new Property("borderStyle", "enum", this.borderStyle, ["solid", "dashed", "none"])
    ];
  }
}
