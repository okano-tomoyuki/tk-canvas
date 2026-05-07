import { Property } from "./property";

export abstract class Widget {
  parent: Widget | null = null;
  children: Widget[] = [];
  visible : boolean = true;
  enable : boolean = true;
  x: number = 0;
  y: number = 0;
  width: number = 0;
  height: number = 0;

  constructor() {}

  // --- 描画 ---
  abstract paint(ctx: CanvasRenderingContext2D): void;

  abstract getProperties(): Property<any>[];

  canHaveChildren(): boolean {
    return false; // デフォルトは子を持てない
  }

  canBeChild(): boolean {
    return true; // デフォルトは子になれる
  }

  protected assign(props: Record<string, any>) {
    for (const key of Object.keys(props)) {
      if (key in this) {
        (this as any)[key] = props[key];
      }
    }
  }

  setProperty(key: string, value : any): void {
    (this as any)[key] = value;
  }

  // --- ヒットテスト ---
  contains(px: number, py: number): boolean {
    const ax = this.getAbsoluteX();
    const ay = this.getAbsoluteY();

    return (
      px >= ax &&
      px <= ax + this.width &&
      py >= ay &&
      py <= ay + this.height
    );
  }

  // --- 移動 ---
  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  getAbsoluteX(): number {
    return this.parent ? this.parent.getAbsoluteX() + this.x : this.x;
  }

  getAbsoluteY(): number {
    return this.parent ? this.parent.getAbsoluteY() + this.y : this.y;
  }

}
