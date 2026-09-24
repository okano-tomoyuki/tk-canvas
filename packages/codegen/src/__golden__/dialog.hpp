#pragma once

#include "cpp_tk.hpp"

/** tk-designer で作成した画面（dialog.tkui.json）。マーカーで囲まれた区間は再生成で上書きされる。 */
class Dialog
{
public:
    explicit Dialog(const cpp_tk::Widget& master);
    Dialog(const Dialog&) = delete;
    Dialog& operator=(const Dialog&) = delete;

private:
    // <tk-designer:begin id="declarations">
    const cpp_tk::Widget& tkd_master;
    cpp_tk::Toplevel main_window;
    cpp_tk::StringVar user_name;
    cpp_tk::IntVar mode;
    cpp_tk::DoubleVar level;
    cpp_tk::ttk::Label name_label;
    cpp_tk::ttk::Entry name_entry;
    cpp_tk::ttk::Radiobutton mode_a;
    cpp_tk::ttk::Radiobutton mode_b;
    cpp_tk::ttk::Scale level_scale;
    cpp_tk::ttk::Notebook tabs;
    cpp_tk::ttk::Frame general_page;
    cpp_tk::ttk::Button submit_button;

    void tkd_create_widgets();
    void tkd_apply_layout();
    void tkd_bind_events();

    void on_name_return(const cpp_tk::Event& event);
    void on_level(const double& value);
    void on_submit();
    // <tk-designer:end id="declarations" hash="b72f6e25">
};
