/**
 * 生成クラスの基底クラス（docs/adr/0011）が持つ名前。ウィジェット・変数・ハンドラは生成クラスのメンバになるため、
 * これらと同じ名前にすると基底クラスのメソッドや属性を上書き・隠蔽してしまう。
 * ルートのクラスを後から変えても問題が起きないよう、ルートにできるすべてのクラスの名前をまとめて予約する。
 *
 * - Python: tkinter の Tk / Toplevel / Frame / LabelFrame / ttk.Frame / ttk.Labelframe の dir() と
 *   インスタンス属性（Python 3.14。"__" で始まるものを除く）
 * - C++: cpp_tk の Object / InterpreterClient / Widget / Tk / Toplevel / Frame / LabelFrame /
 *   ttk::Frame / ttk::Labelframe の public・protected メンバ
 */

const PYTHON_NAMES = `
  _Misc__winfo_getint _Misc__winfo_parseitem _bind _configure _displayof _do _getboolean
  _getconfigure _getconfigure1 _getdoubles _getints _grid_configure _gridconvvalue _last_child_ids
  _loadtk _name _nametowidget _noarg_ _options _register _report_exception _root _setup
  _subst_format _subst_format_str _substitute _tclCommands _tkloaded _unbind _w _windowingsystem
  after after_cancel after_idle after_info anchor aspect attributes bbox bell bind bind_all
  bind_class bindtags busy busy_cget busy_config busy_configure busy_current busy_forget busy_hold
  busy_status cget children client clipboard_append clipboard_clear clipboard_get colormapwindows
  columnconfigure command config configure deiconify deletecommand destroy event_add event_delete
  event_generate event_info focus focus_displayof focus_force focus_get focus_lastfor focus_set
  focusmodel forget frame geometry getboolean getdouble getint getvar grab_current grab_release
  grab_set grab_set_global grab_status grid grid_anchor grid_bbox grid_columnconfigure
  grid_configure grid_forget grid_info grid_location grid_propagate grid_remove grid_rowconfigure
  grid_size grid_slaves group iconbitmap iconify iconmask iconname iconphoto iconposition
  iconwindow identify image_names image_types info info_patchlevel instate keys lift loadtk
  location lower mainloop manage master maxsize minsize nametowidget option_add option_clear
  option_get option_readfile overrideredirect pack pack_configure pack_forget pack_info
  pack_propagate pack_slaves place place_configure place_forget place_info place_slaves
  positionfrom propagate protocol quit readprofile register report_callback_exception resizable
  rowconfigure selection_clear selection_get selection_handle selection_own selection_own_get send
  setvar size sizefrom slaves state title tk tk_bisque tk_busy tk_busy_cget tk_busy_config
  tk_busy_configure tk_busy_current tk_busy_forget tk_busy_hold tk_busy_status
  tk_focusFollowsMouse tk_focusNext tk_focusPrev tk_setPalette tk_strictMotif tkraise transient
  unbind unbind_all unbind_class update update_idletasks wait_variable wait_visibility wait_window
  waitvar widgetName winfo_atom winfo_atomname winfo_cells winfo_children winfo_class
  winfo_colormapfull winfo_containing winfo_depth winfo_exists winfo_fpixels winfo_geometry
  winfo_height winfo_id winfo_interps winfo_ismapped winfo_manager winfo_name winfo_parent
  winfo_pathname winfo_pixels winfo_pointerx winfo_pointerxy winfo_pointery winfo_reqheight
  winfo_reqwidth winfo_rgb winfo_rootx winfo_rooty winfo_screen winfo_screencells
  winfo_screendepth winfo_screenheight winfo_screenmmheight winfo_screenmmwidth winfo_screenvisual
  winfo_screenwidth winfo_server winfo_toplevel winfo_viewable winfo_visual winfo_visualid
  winfo_visualsavailable winfo_vrootheight winfo_vrootwidth winfo_vrootx winfo_vrooty winfo_width
  winfo_x winfo_y withdraw wm_aspect wm_attributes wm_client wm_colormapwindows wm_command
  wm_deiconify wm_focusmodel wm_forget wm_frame wm_geometry wm_grid wm_group wm_iconbitmap
  wm_iconify wm_iconmask wm_iconname wm_iconphoto wm_iconposition wm_iconwindow wm_manage
  wm_maxsize wm_minsize wm_overrideredirect wm_positionfrom wm_protocol wm_resizable wm_sizefrom
  wm_state wm_title wm_transient wm_withdraw
`;

const CPP_NAMES = `
  after after_cancel after_idle as_parent attributes bell bind bind_all bind_class bindtags call
  cget checked_interp clipboard_append clipboard_clear clipboard_get config deiconify destroy
  event_generate focus_force focus_get focus_set full_name geometry grab_current grab_release
  grab_set grab_status grid grid_columnconfigure grid_forget grid_info grid_propagate
  grid_rowconfigure grid_slaves handle height iconbitmap iconify iconname iconphoto id impl_
  interp lift lower mainloop maxsize minsize nametowidget option_add option_get overrideredirect
  pack pack_forget pack_info pack_propagate pack_slaves place place_forget place_info place_slaves
  post protocol quit register_after_callback register_bool_callback register_double_callback
  register_event_callback register_string_callback register_void_callback resizable scaling state
  text title tk_focusNext tk_focusPrev transient type_name unbind unbind_all update
  update_idletasks wait_variable wait_visibility wait_window width windowingsystem winfo_children
  winfo_class winfo_containing winfo_depth winfo_exists winfo_geometry winfo_height winfo_id
  winfo_ismapped winfo_manager winfo_name winfo_parent winfo_pointerx winfo_pointery
  winfo_reqheight winfo_reqwidth winfo_rootx winfo_rooty winfo_screenheight winfo_screenwidth
  winfo_toplevel winfo_width winfo_x winfo_y withdraw
`;

const split = (names: string): string[] => names.split(/\s+/).filter((n) => n.length > 0);

export const PYTHON_BASE_MEMBERS: ReadonlySet<string> = new Set(split(PYTHON_NAMES));

export const CPP_BASE_MEMBERS: ReadonlySet<string> = new Set(split(CPP_NAMES));
