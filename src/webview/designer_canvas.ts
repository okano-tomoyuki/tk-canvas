import { Widget } from "./widget/widget";
import { Panel } from "./widget/panel";
import { Label } from "./widget/label";
import { Button } from "./widget/button";
import { Checkbox } from "./widget/checkbox";
import { Textfield } from "./widget/textfield";
import { PropertyPanel } from "./property_panel";
import { WidgetTree } from "./widget_tree";

export class DesignerCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreen: HTMLCanvasElement;
  private offctx: CanvasRenderingContext2D;
  widgets: Widget[] = [];
  selectedItems: Widget[] = [];
  private propertyPanel: PropertyPanel | null = null;
  private tree: WidgetTree | null = null;
  private prevX = 0;
  private prevY = 0;
  private isDragging: boolean = false;
  private resizeHandles: { x: number, y: number, dir: string }[] = [];
  private resizing: boolean = false;
  private resizeDir: string = "";
  private startX = 0;
  private startY = 0;
  private startW = 0;
  private startH = 0;
  private startWidgetX = 0;
  private startWidgetY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    this.offscreen = document.createElement("canvas");
    this.offctx = this.offscreen.getContext("2d")!;
    this.resize();

    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
    canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
    canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
  }

  // -----------------------------
  // Widget 追加
  // -----------------------------
  public addWidget(type: string) {
    let w: Widget | null = null;

    switch (type) {
      case "panel":
        w = new Panel({ x: 50, y: 50, width: 100, height: 80 });
        break;
      case "label":
        w = new Label({ x: 50, y: 50 });
        break;
      case "button":
        w = new Button({ x: 50, y: 50, width: 120, height: 40 });
        break;
      case "checkbox":
        w = new Checkbox({ x: 50, y: 50 });
        break;
      case "textfield":
        w = new Textfield({ x: 50, y: 50 });
        break;
    }

    if (w) {
      this.widgets.push(w);
      this.render();
    }

    if (this.tree) {
        this.tree.refresh();
    }
  }

  // -----------------------------
  // 保存 / 読込
  // -----------------------------
  public save() {
    // ★ プロパティ抽出（ラムダ）
    const extractProps = (widget: Widget): Record<string, any> => {
      const props: Record<string, any> = {};
      for (const p of widget.getProperties()) {
        props[p.key] = p.value;
      }
      return props;
    };

    // ★ 再帰シリアライズ（ラムダ）
    const serialize = (widget: Widget): any => {
      return {
        type: widget.constructor.name,
        props: extractProps(widget),
        children: widget.children.map(c => serialize(c))
      };
    };

    // ★ トップレベル widgets を保存
    return this.widgets.map(w => serialize(w));
  }

  public load(json: string) {
    const list: any[] = JSON.parse(json);

    // ★ Widget の生成（ラムダ）
    const create = (type: string, props: Record<string, any>): Widget => {
      switch (type) {
        case "Panel": return new Panel(props);
        case "Label": return new Label(props);
        case "Button": return new Button(props);
        case "Checkbox": return new Checkbox(props);
        case "Textfield": return new Textfield(props);
        default:
          throw new Error("Unknown widget type: " + type);
      }
    };

    // ★ 再帰デシリアライズ（ラムダ）
    const deserialize = (data: any): Widget => {
      const widget = create(data.type, data.props);

      for (const childData of data.children ?? []) {
        const child = deserialize(childData);
        child.parent = widget;
        widget.children.push(child);
      }

      return widget;
    };

    // ★ トップレベル widgets を再構築
    this.widgets = list.map(item => deserialize(item));

    this.render();

    if (this.tree) {
        this.tree.refresh();
    }
  }

  // -----------------------------
  // レンダリング
  // -----------------------------
  public render() {
    this.drawToOffscreen();

    // ★ 選択中の Widget にリサイズハンドルを描画
    if (this.selectedItems.length === 1) {
      const w = this.selectedItems[0];
      this.drawSelectionFrame(this.offctx, w);
      this.drawResizeHandles(this.offctx, w);
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.offscreen, 0, 0);
  }

  private drawToOffscreen() {
    const w = this.canvas.width;
    const h = this.canvas.height;

    this.offctx.clearRect(0, 0, w, h);
    this.offctx.fillStyle = "white";
    this.offctx.fillRect(0, 0, w, h);

    for (const widget of this.widgets) {
      widget.paint(this.offctx);
    }
  }

  private drawSelectionFrame(ctx: CanvasRenderingContext2D, w: Widget) {
    const ax = w.getAbsoluteX();
    const ay = w.getAbsoluteY();    

    ctx.strokeStyle = "rgb(0, 120, 215)";
    ctx.lineWidth = 2;
    ctx.strokeRect(
      ax - 2,
      ay - 2,
      w.width + 4,
      w.height + 4
    );    
  }

  private drawResizeHandles(ctx: CanvasRenderingContext2D, w: Widget) {
    const size = 6;
    const half = size / 2;

    // ★ 絶対座標を取得
    const ax = w.getAbsoluteX();
    const ay = w.getAbsoluteY();

    const points = [
      { x: ax, y: ay, dir: "nw" },
      { x: ax + w.width / 2, y: ay, dir: "n" },
      { x: ax + w.width, y: ay, dir: "ne" },

      { x: ax, y: ay + w.height / 2, dir: "w" },
      { x: ax + w.width, y: ay + w.height / 2, dir: "e" },

      { x: ax, y: ay + w.height, dir: "sw" },
      { x: ax + w.width / 2, y: ay + w.height, dir: "s" },
      { x: ax + w.width, y: ay + w.height, dir: "se" },
    ];

    this.resizeHandles = points;

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";

    for (const p of points) {
      ctx.fillRect(p.x - half, p.y - half, size, size);
      ctx.strokeRect(p.x - half, p.y - half, size, size);
    }
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    this.canvas.width = w;
    this.canvas.height = h;

    this.offscreen.width = w;
    this.offscreen.height = h;

    this.render();
  }

  public setPropertyPanel(panel: PropertyPanel) {
    this.propertyPanel = panel;
  }

  public setTreeView(tree: WidgetTree) {
    this.tree = tree;
  }

  private onMouseDown(e: MouseEvent) {
    const x = e.offsetX;
    const y = e.offsetY;

    this.prevX = x;
    this.prevY = y;

    // リサイズハンドル判定
    if (this.selectedItems.length === 1) {
      for (const h of this.resizeHandles) {
        if (Math.abs(x - h.x) < 6 && Math.abs(y - h.y) < 6) {
          this.resizing = true;
          this.resizeDir = h.dir;

          const w = this.selectedItems[0];
          this.startX = x;
          this.startY = y;
          this.startW = w.width;
          this.startH = w.height;
          this.startWidgetX = w.x;
          this.startWidgetY = w.y;

          return;
        }
      }
    }

    // 再帰ヒットテスト
    const hitTest = (widgets: Widget[]): Widget | null => {
      for (let i = widgets.length - 1; i >= 0; i--) {
        const w = widgets[i];

        // 子を先にチェック（深い方が優先）
        const childHit = hitTest(w.children);
        if (childHit) {
          return childHit;
        }

        // 自分自身のヒット判定（絶対座標）
        if (w.contains(x, y)) {
          return w;
        }
      }
      return null;
    };

    // 通常の選択処理（トップレベルから再帰的に検索）
    const hit = hitTest(this.widgets);

    if (hit) {
      this.isDragging = true;
      this.selectedItems = [hit];

      if (this.propertyPanel) {
        this.propertyPanel.setWidget(hit);
      }
    } else {
      this.isDragging = false;
      this.selectedItems = [];

      if (this.propertyPanel) {
        this.propertyPanel.setWidget(null);
      }
    }

    this.render();
  }


  private onMouseMove(e: MouseEvent) {
    const x = e.offsetX;
    const y = e.offsetY;

    // ★ リサイズ中
    if (this.resizing && this.selectedItems.length === 1) {
      const w = this.selectedItems[0];
      const dx = x - this.startX;
      const dy = y - this.startY;

      if (this.resizeDir.includes("e")) {
        w.width = this.startW + dx;
      }

      if (this.resizeDir.includes("s")) {
        w.height = this.startH + dy;
      }

      if (this.resizeDir.includes("w")) {
        w.x = this.startWidgetX + dx;
        w.width = this.startW - dx;
      }

      if (this.resizeDir.includes("n")) {
        w.y = this.startWidgetY + dy;
        w.height = this.startH - dy;
      }

      if (this.propertyPanel) {
        this.propertyPanel.setWidget(w);
      }

      this.render();
      return;
    }

    // ★ 通常のドラッグ
    if (!this.isDragging || this.selectedItems.length === 0) {
      return;
    }

    const dx = x - this.prevX;
    const dy = y - this.prevY;

    this.prevX = x;
    this.prevY = y;

    for (const w of this.selectedItems) {
      w.move(dx, dy);
    }

    if (this.propertyPanel) {
      this.propertyPanel.setWidget(this.selectedItems[0]);
    }

    this.render();
  }

  private onMouseUp(e: MouseEvent) {
    const x = e.offsetX;
    const y = e.offsetY;

    if (this.selectedItems.length === 1) {
      const child = this.selectedItems[0];
      const parent = this.findParentAt(x, y, child);

      if (parent) {
        this.attachToParent(child, parent);
      } else {
        this.detachFromParent(child);
      }
      
      if (this.tree) {
         this.tree.refresh();
      }
    }

    // 選択解除
    // this.selectedItems = [];
    this.isDragging = false;
    this.resizing = false;
    this.resizeDir = "";
    this.render();
  }

  private findParentAt(x: number, y: number, child: Widget): Widget | null {
    // 逆順で検索（上に描画されているものを優先）
    for (let i = this.widgets.length - 1; i >= 0; i--) {
      const w = this.widgets[i];

      // 自分自身は親になれない
      if (w === child) {
        continue;
      }

      // 子を持てない Widget はスキップ
      if (!w.canHaveChildren()) {
        continue;
      }

      // ヒットしていれば親候補
      if (w.contains(x, y)) {
        return w;
      }
    }
    return null;
  }

  private attachToParent(child: Widget, parent: Widget) {
    // ★ 先に絶対座標を退避しておく
    const absX = child.getAbsoluteX();
    const absY = child.getAbsoluteY();

    // すでに親がいる場合は外す
    if (child.parent) {
      child.parent.children = child.parent.children.filter(c => c !== child);
    }

    // 親の children に追加
    parent.children.push(child);
    child.parent = parent;

    // ★ 退避しておいた絶対座標から相対座標を計算
    child.x = absX - parent.getAbsoluteX();
    child.y = absY - parent.getAbsoluteY();

    // トップレベル widgets から外す
    this.widgets = this.widgets.filter(w => w !== child);

    this.render();
  }

  private detachFromParent(child: Widget) {
    // 親がいないなら何もしない
    if (!child.parent) {
      return;
    }

    // ★ 絶対座標を退避
    const absX = child.getAbsoluteX();
    const absY = child.getAbsoluteY();

    // 親から削除
    child.parent.children = child.parent.children.filter(c => c !== child);
    child.parent = null;

    // ★ トップレベルに追加
    this.widgets.push(child);

    // ★ 相対座標 → 絶対座標に戻す
    child.x = absX;
    child.y = absY;
  }

  public selectWidgetFromTree(widget: Widget) {
    this.selectedItems = [widget];
    if (this.propertyPanel) {
      this.propertyPanel.setWidget(widget);
    }
    this.render();
  }

}
