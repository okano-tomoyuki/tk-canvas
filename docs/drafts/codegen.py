import json
from textwrap import indent


def indent_block(code: str, level: int = 1) -> str:
    return indent(code, " " * (4 * level))


def dict_to_args(d: dict) -> str:
    if not d:
        return ""
    parts = []
    for k, v in d.items():
        if isinstance(v, str):
            parts.append(f"{k}={json.dumps(v)}")
        else:
            parts.append(f"{k}={v}")
    return ", ".join(parts)


# ---------------------------------------------------------
#  Declarations (recursive)
# ---------------------------------------------------------
def gen_declarations(node) -> list[str]:
    lines = [f"self.{node['id']} = None"]
    for child in node.get("children", []):
        lines.extend(gen_declarations(child))
    return lines


# ---------------------------------------------------------
#  Widget creation (recursive)
# ---------------------------------------------------------
def gen_build_ui(node, parent_var: str) -> list[str]:
    lines = []

    props = node.get("properties", {})
    prop_str = dict_to_args(props)
    lines.append(
        f"self.{node['id']} = tk.{node['type']}({parent_var}"
        + (f", {prop_str}" if prop_str else "")
        + ")"
    )

    events = node.get("events", {})
    for ev, handler in events.items():
        if ev == "onClick":
            lines.append(
                f"self.{node['id']}.configure(command=self.{handler})"
            )

    for child in node.get("children", []):
        lines.extend(gen_build_ui(child, f"self.{node['id']}"))

    return lines


# ---------------------------------------------------------
#  Layout (recursive)
# ---------------------------------------------------------
def gen_layout(node, parent_manager: str | None) -> list[str]:
    lines = []

    # 自分自身の layoutPolicy があれば、それを優先
    manager = parent_manager
    if "layoutPolicy" in node:
        manager = node["layoutPolicy"]["manager"]

    layout = node.get("layout", {})

    if manager == "grid":
        args = dict_to_args(layout.get("grid", {}))
        lines.append(
            f"self.{node['id']}.grid({args})" if args else
            f"self.{node['id']}.grid()"
        )
    elif manager == "pack":
        args = dict_to_args(layout.get("pack", {}))
        lines.append(
            f"self.{node['id']}.pack({args})" if args else
            f"self.{node['id']}.pack()"
        )
    elif manager == "place":
        args = dict_to_args(layout.get("place", {}))
        lines.append(
            f"self.{node['id']}.place({args})" if args else
            f"self.{node['id']}.place()"
        )

    for child in node.get("children", []):
        lines.extend(gen_layout(child, manager))

    return lines


# ---------------------------------------------------------
#  Event stubs (recursive)
# ---------------------------------------------------------
def gen_event_stubs(node) -> list[str]:
    lines = []
    events = node.get("events", {})
    for _, handler in events.items():
        lines.append(f"def {handler}(self):\n    pass\n")

    for child in node.get("children", []):
        lines.extend(gen_event_stubs(child))

    return lines


# ---------------------------------------------------------
#  Main generator
# ---------------------------------------------------------
def generate_code(dsl: dict) -> str:
    root = dsl["root"]

    decl_lines = gen_declarations(root)
    build_lines = gen_build_ui(root, "self.root")
    layout_lines = gen_layout(root, None)
    event_lines = gen_event_stubs(root)

    declarations = indent_block("\n".join(decl_lines))
    build_ui = indent_block("\n".join(build_lines))
    layout = indent_block("\n".join(layout_lines))
    events = indent_block("\n".join(event_lines))

    code = f'''import tkinter as tk

class GeneratedUI:
    def __init__(self, root):
        self.root = root

        self.root.title({json.dumps(dsl["window"]["title"])})
        self.root.geometry({json.dumps(dsl["window"]["size"])})

        # ==== Widget Declarations ====
{declarations}

    def build_ui(self):
        # ==== Widget Creation ====
{build_ui}

    def apply_layout(self):
        # ==== Layout ====
{layout}

    # ==== Event Stubs ====
{events}
'''
    return code


# ---------------------------------------------------------
#  CLI entry point
# ---------------------------------------------------------
if __name__ == "__main__":
    with open("ui.json", "r", encoding="utf-8") as f:
        dsl = json.load(f)

    generated = generate_code(dsl)

    with open("auto_generated_ui.py", "w", encoding="utf-8") as f:
        f.write(generated)

    print("Generated auto_generated_ui.py")
