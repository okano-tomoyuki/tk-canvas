import { Property } from "./property";
import { Widget } from "./widget";

export class Textfield extends Widget {
  text: string = "Text";

  constructor(props?: Record<string, any>) {
    super();
    this.width = 120;
    this.height = 24;
    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 絶対座標を取得 ---
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    // --- 背景 ---
    ctx.fillStyle = "white";
    ctx.fillRect(ax, ay, this.width, this.height);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, ay, this.width, this.height);

    // --- テキスト ---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.text, ax + 4, ay + this.height - 6);
  }

  getProperties(): Property<any>[] {
    return [
      new Property("enable", "boolean", this.enable),
      new Property("visible", "boolean", this.visible),
      new Property("x", "number", this.x),
      new Property("y", "number", this.y),
      new Property("width", "number", this.width),
      new Property("height", "number", this.height),
      new Property("text", "string", this.text)
    ];
  }
}
