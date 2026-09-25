import tkinter as tk
from tkinter import ttk


class SettingsPanel(ttk.Labelframe):
    """tk-designer で作成した画面（settings_panel.tkui.json）。マーカーで囲まれた区間は再生成で上書きされる。"""

    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        # <tk-designer:begin id="declarations">
        self.user_name: tk.StringVar
        self.mode: tk.IntVar
        self.level: tk.DoubleVar
        self.name_label: ttk.Label
        self.name_entry: ttk.Entry
        self.mode_a: ttk.Radiobutton
        self.mode_b: ttk.Radiobutton
        self.level_scale: ttk.Scale
        self.tabs: ttk.Notebook
        self.general_page: ttk.Frame
        self.submit_button: ttk.Button
        # <tk-designer:end id="declarations" hash="566b9fb7">

        self.tkd_create_widgets()
        self.tkd_apply_layout()
        self.tkd_bind_events()

    # <tk-designer:begin id="tkd_create_widgets">
    def tkd_create_widgets(self):
        self.configure(text="Settings", padding=8)

        self.user_name = tk.StringVar(master=self, value="")
        self.mode = tk.IntVar(master=self, value=1)
        self.level = tk.DoubleVar(master=self)

        self.name_label = ttk.Label(self, text="Name:")
        self.name_entry = ttk.Entry(self, textvariable=self.user_name, font=("Arial", 12, "bold"))
        self.mode_a = ttk.Radiobutton(self, text="A", variable=self.mode, value=1)
        self.mode_b = ttk.Radiobutton(self, text="B", variable=self.mode, value=2)
        self.level_scale = ttk.Scale(self, from_=0, to=10, variable=self.level)
        self.tabs = ttk.Notebook(self)
        self.general_page = ttk.Frame(self.tabs, padding=8)
        self.submit_button = ttk.Button(self.general_page, text="OK")
    # <tk-designer:end id="tkd_create_widgets" hash="9a8fe07f">

    # <tk-designer:begin id="tkd_apply_layout">
    def tkd_apply_layout(self):
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(3, weight=1)
        self.name_label.grid(row=0, column=0, sticky="w", padx=(8, 4))
        self.name_entry.grid(row=0, column=1, sticky="ew")
        self.mode_a.grid(row=1, column=0)
        self.mode_b.grid(row=1, column=1, sticky="w")
        self.level_scale.grid(row=2, column=0, columnspan=2, sticky="ew")
        self.tabs.grid(row=3, column=0, columnspan=2, sticky="nsew")

        self.tabs.add(self.general_page, text="General", padding=4)

        self.general_page.pack_propagate(False)
        self.submit_button.pack(side="right")
    # <tk-designer:end id="tkd_apply_layout" hash="e7c1f117">

    # <tk-designer:begin id="tkd_bind_events">
    def tkd_bind_events(self):
        self.bind("<Configure>", self.on_resize)
        self.name_entry.bind("<Return>", self.on_name_return)
        self.level_scale.configure(command=self.on_level)
        self.submit_button.configure(command=self.on_submit)
    # <tk-designer:end id="tkd_bind_events" hash="b6ea4e06">

    # <tk-designer:handler-stubs>

    def on_resize(self, event):
        pass

    def on_name_return(self, event):
        pass

    def on_level(self, value):
        pass

    def on_submit(self):
        pass
