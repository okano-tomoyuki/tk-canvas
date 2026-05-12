import { Widget } from "./widget";
import { Property } from "./property";
import { Frame } from "./frame";

export class Notebook extends Widget {
  tabNames: string[] = [];
  activeTab: number = 0;
  private readonly tabHeight : number = 28;
  private readonly tabWidth : number = 80;

  constructor(props?: Record<string, any>) {
    super();
    this.width = 300;
    this.height = 200;

    // --- デフォルトページ ---
    const page = new Frame({
      x: 0,
      y: this.tabHeight,
      width: this.width,
      height: this.height - this.tabHeight,
    });

    page.parent = this;
    this.children.push(page); // 描画・ヒットテスト用
    this.tabNames.push("Tab1");

    if (props) {
      this.assign(props);
    }
  }

  paint(ctx: CanvasRenderingContext2D): void {
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    // --- タブバー背景 ---
    ctx.fillStyle = "#ddd";
    ctx.fillRect(ax, ay, this.width, this.tabHeight);

    // --- タブ描画 ---
    for (let i = 0; i < this.tabNames.length; i++) {
      const tx = ax + i * this.tabWidth;

      ctx.fillStyle = (i === this.activeTab) ? "#fff" : "#ccc";
      ctx.fillRect(tx, ay, this.tabWidth, this.tabHeight);

      ctx.strokeStyle = "#000";
      ctx.strokeRect(tx, ay, this.tabWidth, this.tabHeight);

      ctx.fillStyle = "#000";
      ctx.font = "14px sans-serif";
      ctx.fillText(this.tabNames[i], tx + 8, ay + 18);
    }

    // --- 選択中ページの描画 ---
    const page = this.children[this.activeTab] as Frame;
    if (page) {
      // Notebook のサイズに追従
      page.x = 0;
      page.y = this.tabHeight;
      page.width = this.width;
      page.height = this.height - this.tabHeight;

      page.paint(ctx);
    }
  }

  addPage(name: string) {
    const page = new Frame({
      x: 0,
      y: this.tabHeight,
      width: this.width,
      height: this.height - this.tabHeight,
    });
    page.parent = this;
    this.children.push(page);
    this.tabNames.push(name);
    this.activeTab = this.children.length - 1;
  }

  removePage(index: number) {
    if (this.children.length <= 1) {
      return;
    }

    this.children.splice(index, 1);
    this.tabNames.splice(index, 1);

    if (this.activeTab >= this.children.length) {
      this.activeTab = this.children.length - 1;
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
