#include "main_window.hpp"

namespace tk = cpp_tk;
namespace ttk = cpp_tk::ttk;

MainWindow::MainWindow()
{
    tkd_create_widgets();
    tkd_apply_layout();
    tkd_bind_events();
}

void MainWindow::run()
{
    main_window.mainloop();
}

// <tk-designer:begin id="tkd_create_widgets">
void MainWindow::tkd_create_widgets()
{
    main_window.title("Sample");
    main_window.geometry("400x300");
    main_window.resizable(true, false);
    main_window.minsize(200, 100);

    user_name.set("");
    mode.set(1);

    name_label = ttk::Label(main_window.as_parent(), {{"text", "Name:"}});
    name_entry = ttk::Entry(main_window.as_parent(), {{"textvariable", user_name}, {"font", std::vector<tk::ArgValue>{"Arial", 12, "bold"}}});
    mode_a = ttk::Radiobutton(main_window.as_parent(), {{"text", "A"}, {"variable", mode}, {"value", 1}});
    mode_b = ttk::Radiobutton(main_window.as_parent(), {{"text", "B"}, {"variable", mode}, {"value", 2}});
    level_scale = ttk::Scale(main_window.as_parent(), {{"from", 0}, {"to", 10}, {"variable", level}});
    tabs = ttk::Notebook(main_window.as_parent());
    general_page = ttk::Frame(tabs.as_parent(), {{"padding", 8}});
    submit_button = ttk::Button(general_page.as_parent(), {{"text", "OK"}});
}
// <tk-designer:end id="tkd_create_widgets" hash="6472e3d8">

// <tk-designer:begin id="tkd_apply_layout">
void MainWindow::tkd_apply_layout()
{
    main_window.grid_columnconfigure(1, {{"weight", 1}});
    main_window.grid_rowconfigure(3, {{"weight", 1}});
    name_label.grid({{"row", 0}, {"column", 0}, {"sticky", "w"}, {"padx", std::vector<tk::ArgValue>{8, 4}}});
    name_entry.grid({{"row", 0}, {"column", 1}, {"sticky", "ew"}});
    mode_a.grid({{"row", 1}, {"column", 0}});
    mode_b.grid({{"row", 1}, {"column", 1}, {"sticky", "w"}});
    level_scale.grid({{"row", 2}, {"column", 0}, {"columnspan", 2}, {"sticky", "ew"}});
    tabs.grid({{"row", 3}, {"column", 0}, {"columnspan", 2}, {"sticky", "nsew"}});

    tabs.add_tab(general_page, "General");
    tabs.tab(general_page.full_name(), {{"padding", 4}});

    general_page.pack_propagate(false);
    submit_button.pack({{"side", "right"}});
}
// <tk-designer:end id="tkd_apply_layout" hash="7273a9ba">

// <tk-designer:begin id="tkd_bind_events">
void MainWindow::tkd_bind_events()
{
    name_entry.bind("<Return>", [this](const tk::Event& event) { on_name_return(event); });
    level_scale.command([this](const double& value) { on_level(value); });
    submit_button.command([this]() { on_submit(); });
}
// <tk-designer:end id="tkd_bind_events" hash="3ac2f4ce">

// <tk-designer:handler-stubs>

void MainWindow::on_name_return(const tk::Event& event)
{
    // TODO: 実装
}

void MainWindow::on_level(const double& value)
{
    // TODO: 実装
}

void MainWindow::on_submit()
{
    // TODO: 実装
}
