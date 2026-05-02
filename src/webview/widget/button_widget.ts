import { Widget } from "./widget";

export class ButtonWidget extends Widget {
  private text: string = "Button";

  constructor(x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
  }

  setText(text: string) {
    this.text = text;
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 背景 ---
    ctx.fillStyle = "#D3D3D3"; // Color.LIGHT_GRAY
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    // --- テキスト（中央寄せ）---
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif"; // Java のデフォルトに近い

    const metrics = ctx.measureText(this.text);
    const textw = metrics.width;

    // Canvas には ascent がないので近似値を使う
    const texth = metrics.actualBoundingBoxAscent ?? 12;

    const tx = this.x + (this.w - textw) / 2;
    const ty = this.y + (this.h + texth) / 2 - 2;

    ctx.fillText(this.text, tx, ty);

    // --- 選択枠 ---
    if (this.selected) {
      ctx.strokeStyle = "rgb(0, 120, 215)"; // Windows風の選択色
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
      enable : this.enable,
      visible : this.visible,
      text : this.text,
      x : this.x,
      y : this.y,
      h : this.h,
      w : this.w,
    };
  }

}
