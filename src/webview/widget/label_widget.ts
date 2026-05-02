import { Widget } from "./widget";

export class LabelWidget extends Widget {
  private text: string = "Label";

  constructor(x: number, y: number) {
    super(x, y, 80, 20); // Java と同じ固定サイズ
  }

  setText(text: string) {
    this.text = text;
  }

  paint(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "black";
    ctx.font = "14px sans-serif";

    // Java の FontMetrics.getAscent() に相当
    const metrics = ctx.measureText(this.text);
    const ascent = metrics.actualBoundingBoxAscent ?? 12;

    ctx.fillText(this.text, this.x, this.y + ascent);

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
