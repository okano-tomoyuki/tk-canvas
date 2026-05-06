import { Property } from "./property";
import { Widget } from "./widget";

export class CheckBoxWidget extends Widget {
  private checked: boolean = false;
  private caption: string = "CheckBox";

  constructor(props?: Record<string, any>) {
    super();
    this.width = 120;
    this.height = 20;
    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- チェックボックス本体 ---
    ctx.fillStyle = "white";
    ctx.fillRect(this.x, this.y, 16, 16);

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, 16, 16);

    // --- チェックマーク ---
    if (this.checked) {
      ctx.strokeStyle = "black";
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.moveTo(this.x + 3, this.y + 8);
      ctx.lineTo(this.x + 7, this.y + 12);
      ctx.lineTo(this.x + 13, this.y + 3);
      ctx.stroke();
    }

    // --- ラベル ---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.caption, this.x + 22, this.y + 14);

    // --- 選択枠 ---
    if (this.selected) {
      ctx.strokeStyle = "rgb(0, 120, 215)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.x - 2,
        this.y - 2,
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
      new Property("checked", "boolean", this.checked)
    ];
  }

}
