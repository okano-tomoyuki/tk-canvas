import { Property } from "./property";
import { Widget } from "./widget";

export class Panel extends Widget {
  fill: string = "#D3D3D3";

  constructor(props?: Record<string, any>) {
    super();
    if (props) {
      this.assign(props);
    }
  }

  override canHaveChildren(): boolean {
    return true;
  }

  paint(ctx: CanvasRenderingContext2D): void {
    // --- 絶対座標を取得 ---
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    // --- 本体の描画 ---
    ctx.fillStyle = this.fill; // Light gray
    ctx.fillRect(ax, ay, this.width, this.height);

    // --- 枠線 ---
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(ax, ay, this.width, this.height);

    // --- 選択状態の可視化 ---
    if (this.selected) {
      ctx.strokeStyle = "rgb(0, 120, 215)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        ax - 2,
        ay - 2,
        this.width + 4,
        this.height + 4
      );
    }

    // --- ★ 子 Widget の描画 ---
    for (const child of this.children) {
      child.paint(ctx);
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
      new Property("fill", "color", this.fill),
    ];
  }
}

