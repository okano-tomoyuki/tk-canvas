import { Widget } from "./widget";
import { Property } from "./property";

export class Text extends Widget {
  private text: string = "Multi-line text\nSecond line";
  private bg: string = "#ffffff";
  private fg: string = "#000000";
  private font: string = "14px sans-serif";

  constructor(props?: Record<string, any>) {
    super();
    this.width = 200;
    this.height = 100;

    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    // 背景
    ctx.fillStyle = this.bg;
    ctx.fillRect(ax, ay, this.width, this.height);

    // 枠線
    ctx.strokeStyle = "#000";
    ctx.strokeRect(ax, ay, this.width, this.height);

    // テキスト（複数行）
    ctx.fillStyle = this.fg;
    ctx.font = this.font;

    const lines = this.text.split("\n");
    let y = ay + 18;

    for (const line of lines) {
      ctx.fillText(line, ax + 4, y);
      y += 18;
    }
  }

  getProperties(): Property<any>[] {
    return [
      new Property("x", "number", this.x),
      new Property("y", "number", this.y),
      new Property("width", "number", this.width),
      new Property("height", "number", this.height),
      new Property("text", "string", this.text),
      new Property("bg", "color", this.bg),
      new Property("fg", "color", this.fg),
      new Property("font", "string", this.font),
    ];
  }

  override canHaveChildren(): boolean {
    return false;
  }
}