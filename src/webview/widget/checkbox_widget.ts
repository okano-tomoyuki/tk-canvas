import { Widget } from "./widget";

export class CheckBoxWidget extends Widget {
  private checked: boolean = false;
  private label: string = "CheckBox";

  constructor(x: number, y: number) {
    super(x, y, 120, 20); // Java と同じ固定サイズ
  }

  setChecked(value: boolean) {
    this.checked = value;
  }

  setLabel(text: string) {
    this.label = text;
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
    ctx.fillText(this.label, this.x + 22, this.y + 14);

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
      x : this.x,
      y : this.y,
      h : this.h,
      w : this.w,
    };
  }

}
