import { Property } from "./property";
import { Widget } from "./widget";

export class Checkbox extends Widget {
  checked: boolean = false;
  caption: string = "CheckBox";

  constructor(props?: Record<string, any>) {
    super();
    this.width = 120;
    this.height = 20;
    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 絶対座標を取得 ---
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    // --- チェックボックス本体 ---
    ctx.fillStyle = "white";
    ctx.fillRect(ax, ay, 16, 16);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, ay, 16, 16);

    // --- チェックマーク ---
    if (this.checked) {
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(ax + 3, ay + 8);
      ctx.lineTo(ax + 7, ay + 12);
      ctx.lineTo(ax + 13, ay + 3);
      ctx.stroke();
    }

    // --- ラベル ---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.caption, ax + 22, ay + 14);

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
      new Property("checked", "boolean", this.checked)
    ];
  }
}
