import { Widget } from "./widget";

export class ButtonWidget extends Widget {
  private text: string = "Button";

  constructor(x: number, y: number, width: number, height: number) {
    super(x, y, width, height);
  }

  setText(text: string) {
    this.text = text;
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 背景 ---
    ctx.fillStyle = "#D3D3D3"; // Color.LIGHT_GRAY
    ctx.fillRect(this.x, this.y, this.width, this.height);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.width, this.height);

    // --- テキスト（中央寄せ）---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif"; // Java のデフォルトに近い

    const metrics = ctx.measureText(this.text);
    const textWidth = metrics.width;

    // Canvas には ascent がないので近似値を使う
    const textHeight = metrics.actualBoundingBoxAscent ?? 12;

    const tx = this.x + (this.width - textWidth) / 2;
    const ty = this.y + (this.height + textHeight) / 2 - 2;

    ctx.fillText(this.text, tx, ty);

    // --- 選択枠 ---
    if (this.selected) {
      ctx.strokeStyle = "rgb(0, 120, 215)"; // Windows風の選択色
      ctx.lineWidth = 2;
      ctx.strokeRect(
        this.x - 2,
        this.y - 2,
        this.width + 4,
        this.height + 4
      );
    }
  }
}
