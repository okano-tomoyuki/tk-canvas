#include "dialog.hpp"

namespace tk = cpp_tk;
namespace ttk = cpp_tk::ttk;

Dialog::Dialog(const cpp_tk::Widget& master)
    : tkd_master(master)
{
    tkd_create_widgets();
    tkd_apply_layout();
    tkd_bind_events();
}

// <tk-designer:begin id="tkd_create_widgets">
void Dialog::tkd_create_widgets()
{
    main_window = tk::Toplevel(tkd_master);
    main_window.title("Dialog");

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
// <tk-designer:end id="tkd_create_widgets" hash="0190ee4f">

// <tk-designer:begin id="tkd_apply_layout">
void Dialog::tkd_apply_layout()
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
// <tk-designer:end id="tkd_apply_layout" hash="7e708287">

// <tk-designer:begin id="tkd_bind_events">
void Dialog::tkd_bind_events()
{
    name_entry.bind("<Return>", [this](const tk::Event& event) { on_name_return(event); });
    level_scale.command([this](const double& value) { on_level(value); });
    submit_button.command([this]() { on_submit(); });
}
// <tk-designer:end id="tkd_bind_events" hash="db98f57d">

// <tk-designer:handler-stubs>

void Dialog::on_name_return(const tk::Event& event)
{
    // TODO: 実装
}

void Dialog::on_level(const double& value)
{
    // TODO: 実装
}

void Dialog::on_submit()
{
    // TODO: 実装
}
