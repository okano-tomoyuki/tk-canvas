import { Widget } from "./widget";
import { Property } from "./property";

export class Notebook extends Widget {
  activeTab: number = -1;
  tabNames: string[] = ["Tab1"];

  constructor(props?: Record<string, any>) {
    super();
    this.width = 300;
    this.height = 200;

    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    const tabHeight = 28;

    // --- タブバー背景 ---
    ctx.fillStyle = "#ddd";
    ctx.fillRect(ax, ay, this.width, tabHeight);

    // --- タブ描画 ---
    const tabWidth = 80;
    for (let i = 0; i < this.tabNames.length; i++) {
      const tx = ax + i * tabWidth;

      ctx.fillStyle = (i === this.activeTab) ? "#fff" : "#ccc";
      ctx.fillRect(tx, ay, tabWidth, tabHeight);

      ctx.strokeStyle = "#000";
      ctx.strokeRect(tx, ay, tabWidth, tabHeight);

      ctx.fillStyle = "#000";
      ctx.font = "14px sans-serif";
      ctx.fillText(this.tabNames[i], tx + 8, ay + 18);
    }

    // --- 選択中ページの描画 ---
    const page = this.children[this.activeTab];
    if (page) {
      page.paint(ctx);
    }
  }

  getProperties(): Property<any>[] {
    return [
      new Property("x", "number", this.x),
      new Property("y", "number", this.y),
      new Property("width", "number", this.width),
      new Property("height", "number", this.height),
      new Property("activeTab", "number", this.activeTab),
      new Property("tabNames", "list", this.tabNames),
    ];
  }

  override canHaveChildren(): boolean {
    return true;
  }
}
