import { Widget } from "./widget";

export class TextFieldWidget extends Widget {
  private text: string = "Text";

  constructor(x: number, y: number) {
    super(x, y, 120, 24); // Java と同じ固定サイズ
  }

  setText(text: string) {
    this.text = text;
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 背景 ---
    ctx.fillStyle = "white";
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    // --- テキスト ---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";
    ctx.fillText(this.text, this.x + 4, this.y + this.h - 6);

    // --- 選択枠 ---
    if (this.selected) {
      ctx.strokeStyle = "rgb(0, 120, 215)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.x - 2,
        this.y - 2,
        this.w + 4,
        this.h + 4
      );
    }
  }

  getProps(): Record<string, any> {
    return {
      x: this.x,
      y: this.y,
      h: this.h,
      w: this.w,
    };
  }

}
