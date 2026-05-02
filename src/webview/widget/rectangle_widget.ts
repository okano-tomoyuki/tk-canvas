import { Widget } from "./widget";

export class RectangleWidget extends Widget {

  constructor(x: number, y: number, w: number, h: number) {
    super(x, y, w, h);
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 本体の描画 ---
    ctx.fillStyle = "#D3D3D3"; // Color.LIGHT_GRAY
    ctx.fillRect(this.x, this.y, this.w, this.h);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    // --- 選択状態の可視化（青い枠）---
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
      x: this.x,
      y: this.y,
      h: this.h,
      w: this.w,
    };
  }
}
