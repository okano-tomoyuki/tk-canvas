#pragma once

#include "cpp_tk.hpp"

/** tk-designer で作成した画面（main_window.tkui.json）。マーカーで囲まれた区間は再生成で上書きされる。 */
class MainWindow : public cpp_tk::Tk
{
public:
    MainWindow();
    MainWindow(const MainWindow&) = delete;
    MainWindow& operator=(const MainWindow&) = delete;

private:
    // <tk-designer:begin id="declarations">
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
    // <tk-designer:end id="declarations" hash="69fa850d">
};
