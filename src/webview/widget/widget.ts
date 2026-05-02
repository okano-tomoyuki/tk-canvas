export abstract class Widget {
  x: number;
  y: number;
  width: number;
  height: number;

  protected selected: boolean = false;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  // --- 描画 ---
  abstract paint(ctx: CanvasRenderingContext2D): void;

  // --- ヒットテスト ---
  contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.width &&
      py >= this.y && py <= this.y + this.height;
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
  getWidth(): number { return this.width; }
  getHeight(): number { return this.height; }
}
