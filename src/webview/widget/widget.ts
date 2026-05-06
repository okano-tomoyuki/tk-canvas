import { Property } from "./property";

export abstract class Widget {
  public visible : boolean = true;
  public enable : boolean = true;
  public x: number = 0;
  public y: number = 0;
  public width: number = 0;
  public height: number = 0;

  protected selected: boolean = false;

  constructor() {}

  // --- 描画 ---
  public abstract paint(ctx: CanvasRenderingContext2D): void;

  public abstract getProperties(): Property<any>[];

  protected assign(props: Record<string, any>) {
    for (const key of Object.keys(props)) {
      if (key in this) {
        (this as any)[key] = props[key];
      }
    }
  }

  public setProperty(key: string, value : any): void {
    (this as any)[key] = value;
  }

  // --- ヒットテスト ---
  public contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.width && py >= this.y && py <= this.y + this.height;
  }

  // --- 移動 ---
  public move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  // --- 選択状態 ---
  public setSelected(selected: boolean): void {
    this.selected = selected;
  }

  public isSelected(): boolean {
    return this.selected;
  }
}
