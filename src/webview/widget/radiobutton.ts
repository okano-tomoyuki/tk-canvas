import { Widget } from "./widget";
import { Property } from "./property";

export class Radiobutton extends Widget {
  caption: string = "Radiobutton";
  checked: boolean = false;
  group: string = "Group";
  private readonly radius: number = 8;

  constructor(props?: Record<string, any>) {
    super();
    this.width = 120;
    this.height = 24;

    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    // --- 円（外側） ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ax + this.radius, ay + this.height / 2, this.radius, 0, Math.PI * 2);
    ctx.stroke();

    // --- 円（内側：選択時） ---
    if (this.checked) {
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(ax + this.radius, ay + this.height / 2, this.radius - 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- テキスト ---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.caption, ax + this.radius * 2 + 6, ay + this.height / 2 + 5);
  }

  getProperties(): Property<any>[] {
    return [
      new Property("visible", "boolean", this.visible),
      new Property("enable", "boolean", this.enable),
      new Property("x", "number", this.x),
      new Property("y", "number", this.y),
      new Property("width", "number", this.width),
      new Property("height", "number", this.height),
      new Property("caption", "string", this.caption),
      new Property("checked", "boolean", this.checked),
      new Property("group", "string", this.group)
    ];
  }

  // Radiobutton は子を持てない
  override canHaveChildren(): boolean {
    return false;
  }
}
