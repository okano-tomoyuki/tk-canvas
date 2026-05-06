import { Property } from "./property";
import { Widget } from "./widget";

export class TextFieldWidget extends Widget {
  private text: string = "Text";

  constructor(props?: Record<string, any>) {
    super();
    this.width = 120;
    this.height = 24;
    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 背景 ---
    ctx.fillStyle = "white";
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // --- テキスト ---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.text, this.x + 4, this.y + this.height - 6);

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
      new Property("text", "string", this.text)
    ];
  }

}
