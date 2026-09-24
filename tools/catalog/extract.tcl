# ウィジェットカタログの基本情報を Tk から抽出する（docs/adr/0007、docs/catalog.md）。
#
#   tclsh tools/catalog/extract.tcl <出力ファイル>
#
# 各ウィジェットを実際に生成し、configure の戻り値からオプション一覧・既定値を得る。
# さらに各オプションについて次の2つを試し、Tk の応答をそのまま記録する（解釈は TS 側で行う）。
#   1. 現在値の再設定   … エラーになれば生成時にしか指定できないオプション
#   2. 不正な値の設定   … エラーメッセージから値の型・列挙値の候補を推定する

package require Tk
wm withdraw .

# DSL のクラス名 → Tcl のコマンド（"." は既存のルートウィンドウを使う）
set classes {
    tk.Tk            .
    tk.Toplevel      toplevel
    tk.Frame         frame
    tk.Button        button
    tk.Canvas        canvas
    tk.Checkbutton   checkbutton
    tk.Entry         entry
    tk.Label         label
    tk.LabelFrame    labelframe
    tk.Listbox       listbox
    tk.Menu          menu
    tk.Menubutton    menubutton
    tk.Message       message
    tk.PanedWindow   panedwindow
    tk.Radiobutton   radiobutton
    tk.Scale         scale
    tk.Scrollbar     scrollbar
    tk.Spinbox       spinbox
    tk.Text          text
    ttk.Button       ttk::button
    ttk.Checkbutton  ttk::checkbutton
    ttk.Combobox     ttk::combobox
    ttk.Entry        ttk::entry
    ttk.Frame        ttk::frame
    ttk.Label        ttk::label
    ttk.Labelframe   ttk::labelframe
    ttk.Menubutton   ttk::menubutton
    ttk.Notebook     ttk::notebook
    ttk.PanedWindow  ttk::panedwindow
    ttk.Progressbar  ttk::progressbar
    ttk.Radiobutton  ttk::radiobutton
    ttk.Scale        ttk::scale
    ttk.Scrollbar    ttk::scrollbar
    ttk.Separator    ttk::separator
    ttk.Sizegrip     ttk::sizegrip
    ttk.Spinbox      ttk::spinbox
    ttk.Treeview     ttk::treeview
}

set INVALID "__tkd_invalid__"

proc json_str {s} {
    set map [list \\ \\\\ \" \\\" \n \\n \r \\r \t \\t]
    return "\"[string map $map $s]\""
}

# 不正な値の設定に失敗したウィジェットは内部状態が壊れることがある（例: menubutton の -image）ため、
# オプションごとに新しいウィジェットを生成して試す。
proc probe_option {command opt} {
    global INVALID
    set w [new_widget $command]
    set current [$w cget $opt]
    # 1. 現在値の再設定
    set creation_only [catch {$w configure $opt $current} err1]
    # 2. 不正な値の設定
    if {[catch {$w configure $opt $INVALID} err2]} {
        set probe_error $err2
    } else {
        set probe_error ""
    }
    destroy $w
    return [list $creation_only $err1 $probe_error]
}

# ルート（"."）は作り直せないため、同じオプションを持つ toplevel で代用する
proc new_widget {command} {
    global widget_seq
    set path .probe[incr widget_seq]
    if {$command eq "."} {
        return [toplevel $path]
    }
    return [$command $path]
}

proc extract_class {name command} {
    # オプション一覧はルート自身（"."）または新しく生成したウィジェットから取る
    set w [expr {$command eq "." ? "." : [new_widget $command]}]
    set options {}
    set aliases {}
    foreach spec [$w configure] {
        if {[llength $spec] == 2} {
            # 別名: {-bd -borderwidth}
            lappend aliases "[json_str [string range [lindex $spec 0] 1 end]]: [json_str [string range [lindex $spec 1] 1 end]]"
            continue
        }
        lassign $spec opt db_name db_class default current
        lassign [probe_option $command $opt] creation_only creation_error probe_error
        set fields [list \
            "\"name\": [json_str [string range $opt 1 end]]" \
            "\"dbName\": [json_str $db_name]" \
            "\"dbClass\": [json_str $db_class]" \
            "\"default\": [json_str $default]" \
            "\"creationOnly\": [expr {$creation_only ? "true" : "false"}]"]
        if {$creation_only} {
            lappend fields "\"creationError\": [json_str $creation_error]"
        }
        lappend fields "\"probeError\": [json_str $probe_error]"
        lappend options "      \{[join $fields {, }]\}"
    }
    if {$w ne "."} { destroy $w }
    return "    [json_str $name]: \{\n      \"tclCommand\": [json_str $command],\n      \"aliases\": \{[join $aliases {, }]\},\n      \"options\": \[\n[join $options ",\n"]\n      \]\n    \}"
}

if {$argc != 1} {
    puts stderr "usage: tclsh extract.tcl <output.json>"
    exit 1
}

set widget_seq 0
set entries {}
foreach {name command} $classes {
    lappend entries [extract_class $name $command]
}

set out [open [lindex $argv 0] w]
fconfigure $out -encoding utf-8 -translation lf
puts $out "\{"
puts $out "  \"tkVersion\": [json_str [info patchlevel]],"
puts $out "  \"windowingSystem\": [json_str [tk windowingsystem]],"
puts $out "  \"classes\": \{"
puts $out [join $entries ",\n"]
puts $out "  \}"
puts $out "\}"
close $out
exit 0
