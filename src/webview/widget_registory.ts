import { Widget } from "./widget/widget";
import { Frame } from "./widget/frame";
import { Label } from "./widget/label";
import { Button } from "./widget/button";
import { Checkbutton } from "./widget/checkbutton";
import { Entry } from "./widget/entry";
import { Text } from "./widget/text";
import { Radiobutton } from "./widget/radiobutton";
import { Scale } from "./widget/scale";
import { Notebook } from "./widget/notebook";
// Notebook, Menu などもここに追加

export class WidgetRegistry {
  private static registry: Record<string, new (props: any) => Widget> = {};

  static register(name: string, ctor: new (props: any) => Widget) {
    this.registry[name] = ctor;
  }

  static create(name: string, props: any): Widget {
    const ctor = this.registry[name];
    if (!ctor) {
      throw new Error("Unknown widget type: " + name);
    }
    return new ctor(props);
  }
}

// ★ ここで一括登録（Widget 側は何も知らない）
WidgetRegistry.register("Frame", Frame);
WidgetRegistry.register("Label", Label);
WidgetRegistry.register("Button", Button);
WidgetRegistry.register("Checkbutton", Checkbutton);
WidgetRegistry.register("Entry", Entry);
WidgetRegistry.register("Text", Text);
WidgetRegistry.register("Radiobutton", Radiobutton);
WidgetRegistry.register("Scale", Scale);
WidgetRegistry.register("Notebook", Notebook);
// Notebook, Menu もここに追加
