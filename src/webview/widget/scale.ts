import { Widget } from "./widget";
import { Property } from "./property";

export class Scale extends Widget {
  private value: number = 50;
  private from: number = 0;
  private to: number = 100;
  private orient: "horizontal" | "vertical" = "horizontal";

  constructor(props?: Record<string, any>) {
    super();
    this.width = 200;
    this.height = 40;

    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;

    if (this.orient === "horizontal") {
      // --- バー ---
      ctx.beginPath();
      ctx.moveTo(ax + 10, ay + this.height / 2);
      ctx.lineTo(ax + this.width - 10, ay + this.height / 2);
      ctx.stroke();

      // --- ノブ位置 ---
      const ratio = (this.value - this.from) / (this.to - this.from);
      const knobX = ax + 10 + ratio * (this.width - 20);

      // --- ノブ ---
      ctx.fillStyle = "#ddd";
      ctx.beginPath();
      ctx.arc(knobX, ay + this.height / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // --- バー（縦） ---
      ctx.beginPath();
      ctx.moveTo(ax + this.width / 2, ay + 10);
      ctx.lineTo(ax + this.width / 2, ay + this.height - 10);
      ctx.stroke();

      // --- ノブ位置 ---
      const ratio = (this.value - this.from) / (this.to - this.from);
      const knobY = ay + this.height - 10 - ratio * (this.height - 20);

      // --- ノブ ---
      ctx.fillStyle = "#ddd";
      ctx.beginPath();
      ctx.arc(ax + this.width / 2, knobY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  getProperties(): Property<any>[] {
    return [
      new Property("x", "number", this.x),
      new Property("y", "number", this.y),
      new Property("width", "number", this.width),
      new Property("height", "number", this.height),
      new Property("value", "number", this.value),
      new Property("from", "number", this.from),
      new Property("to", "number", this.to),
      new Property("orient", "enum", this.orient, ["horizontal", "vertical"]),
    ];
  }

  override canHaveChildren(): boolean {
    return false;
  }
}
