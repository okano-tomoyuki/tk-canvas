export abstract class Widget {
  public visible : boolean = true;
  public enable : boolean = true;
  public x: number;
  public y: number;
  public w: number;
  public h: number;

  protected selected: boolean = false;

  constructor(x: number, y: number, w: number, h: number) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }

  // --- 描画 ---
  abstract paint(ctx: CanvasRenderingContext2D): void;

  abstract getProps(): Record<string, any>;

  setProps(key: string, value : any): void {
    (this as any)[key] = value;
  }

  // --- ヒットテスト ---
  contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.w &&
      py >= this.y && py <= this.y + this.h;
  }

  // --- 移動 ---
  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  // --- 選択状態 ---
  setSelected(selected: boolean): void {
    this.selected = selected;
  }

  isSelected(): boolean {
    return this.selected;
  }

  // --- ゲッター ---
  getX(): number { return this.x; }
  getY(): number { return this.y; }
  getW(): number { return this.w; }
  getH(): number { return this.h; }
}
