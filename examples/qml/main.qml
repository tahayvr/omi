// Omi in a Qt Quick app: a window Omi follows along in.
//
//     QML_XHR_ALLOW_FILE_READ=1 qml examples/qml/main.qml
//
// Omi watches the mouse, a click on it (or Space) plays a reaction, ← →
// step through the modes. The cards are the things an app does that Omi
// can show: typing and thinking, a transfer, work behind a button, the
// window going to the background. Everything Omi does here is the Omi item
// (Omi.qml) and its `mode`, `react()` and `look`: copy that file, and the
// kit, into your app.
import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import QtQuick.Layouts

ApplicationWindow {
    id: window
    width: 1100
    height: 820
    minimumWidth: 360
    minimumHeight: 480
    visible: true
    title: "Omi in Qt Quick · " + omi.label

    // ------------------------------------------------------------ theme
    // "" follows the system; "light" or "dark" picks one.
    property string theme: ""
    readonly property bool dark: theme ? theme === "dark"
        : Application.styleHints.colorScheme !== Qt.ColorScheme.Light
    readonly property color bg: dark ? "#11121a" : "#f4f5f9"
    readonly property color panel: dark ? "#181a26" : "#ffffff"
    readonly property color ink: dark ? "#c0caf5" : "#1f2335"
    readonly property color muted: dark ? "#9aa3c7" : "#5a607a"
    readonly property color line: dark ? "#2a2e42" : "#d5d9e6"
    readonly property color accent: dark ? "#7aa2f7" : "#2e7de9"
    readonly property color accentInk: dark ? "#11121a" : "#ffffff"
    // Omi's color: the accent, or a swatch (an empty string is the accent)
    property string picked: ""
    readonly property color omiColor: picked !== "" ? picked : accent
    color: bg

    // A wide window puts Omi beside the cards; a narrow one, on top.
    readonly property bool wide: width >= 900

    // ------------------------------------------------------------ what Omi shows
    // The first of these that is set: what you're doing (typing, a
    // transfer), what the window says (in the background, you away), then
    // the mode you picked. Reactions play over it with omi.react().
    property string activity: ""
    property string signalMode: ""
    property string base: "idle"
    property bool started: false
    readonly property string wanted: activity || signalMode || base

    function pick(id) {
        base = id;
        omi.reaction = "";
    }
    function step(by) {
        const ids = omi.modes.filter(function (m) { return m.id !== "logo"; })
                             .map(function (m) { return m.id; });
        pick(ids[(ids.indexOf(base) + by + ids.length) % ids.length]);
    }
    // the reactions in turn
    property int pokes: 0
    function poke() {
        const r = omi.modes.filter(function (m) { return m.kind === "reaction"; });
        if (r.length) omi.react(r[pokes++ % r.length].id);
    }
    function nameOf(id) {
        const m = omi.modes.filter(function (x) { return x.id === id; })[0];
        return m ? m.name : "";
    }

    // ------------------------------------------------------------ input
    // The eyes follow the mouse, except over the cards (Omi leaves you to
    // it there), and look ahead again when it rests.
    MouseArea {
        anchors.fill: parent
        hoverEnabled: true
        acceptedButtons: Qt.NoButton
        onPositionChanged: function (mouse) {
            if (window.wide && mouse.x > cards.mapToItem(window.contentItem, 0, 0).x) {
                omi.look = [0, 0];
                return;
            }
            const c = omi.mapToItem(window.contentItem, omi.width / 2, omi.height / 2),
                  reach = Math.max(omi.width * 1.5, 240);
            omi.look = [Math.max(-1, Math.min(1, (mouse.x - c.x) / reach)),
                        Math.max(-1, Math.min(1, (mouse.y - c.y) / reach))];
            rest.restart();
            away.active();
        }
        onExited: omi.look = [0, 0]
    }
    Timer { id: rest; interval: 2500; onTriggered: omi.look = [0, 0] }

    // keys, unless a text field has them
    Shortcut { sequence: "Space"; enabled: !(window.activeFocusItem instanceof TextInput); onActivated: { away.active(); window.poke(); } }
    Shortcut { sequence: "Right"; enabled: !(window.activeFocusItem instanceof TextInput); onActivated: { away.active(); window.step(1); } }
    Shortcut { sequence: "Left"; enabled: !(window.activeFocusItem instanceof TextInput); onActivated: { away.active(); window.step(-1); } }

    // ------------------------------------------------------------ small parts
    // Square, like Omi.
    component Btn: Rectangle {
        id: btn
        property string text: ""
        property bool primary: false
        property bool enabled_: true
        // what goes before the label: a small Omi, say
        default property alias content: slot.data
        signal clicked()
        implicitWidth: row.implicitWidth + 28
        implicitHeight: 38
        color: primary ? window.accent : (mouse.containsMouse && enabled_ ? Qt.lighter(window.panel, window.dark ? 1.4 : 0.97) : window.panel)
        border.width: primary ? 0 : 1
        border.color: mouse.containsMouse && enabled_ ? window.muted : window.line
        opacity: enabled_ ? 1 : 0.6
        Row {
            id: row
            anchors.centerIn: parent
            spacing: 8
            Row { id: slot; anchors.verticalCenter: parent.verticalCenter }
            Label {
                anchors.verticalCenter: parent.verticalCenter
                text: btn.text
                color: btn.primary ? window.accentInk : window.ink
                font { pixelSize: 13; bold: btn.primary }
            }
        }
        MouseArea {
            id: mouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: btn.enabled_ ? Qt.PointingHandCursor : Qt.ArrowCursor
            onClicked: if (btn.enabled_) { away.active(); btn.clicked(); }
        }
    }
    component Chip: Rectangle {
        id: chip
        property string text: ""
        property bool on: false
        signal clicked()
        implicitWidth: chipLabel.implicitWidth + 18
        implicitHeight: 30
        color: on ? window.omiColor : "transparent"
        border.width: on ? 0 : 1
        border.color: chipMouse.containsMouse ? window.muted : window.line
        Label {
            id: chipLabel
            anchors.centerIn: parent
            text: chip.text
            color: chip.on ? window.accentInk : window.ink
            font.pixelSize: 12
        }
        MouseArea {
            id: chipMouse
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onClicked: { away.active(); chip.clicked(); }
        }
    }
    component Card: Rectangle {
        id: card
        property string title: ""
        property string blurb: ""
        default property alias content: body.data
        Layout.fillWidth: true
        implicitHeight: body.implicitHeight + 40
        color: window.panel
        border.color: window.line
        ColumnLayout {
            id: body
            anchors { left: parent.left; right: parent.right; top: parent.top; margins: 20 }
            spacing: 12
            Label { text: card.title; color: window.ink; font { pixelSize: 15; bold: true } }
            Label {
                Layout.fillWidth: true
                Layout.topMargin: -6
                text: card.blurb
                visible: text !== ""
                color: window.muted
                wrapMode: Text.Wrap
                font.pixelSize: 12
            }
        }
    }

    // ------------------------------------------------------------ layout
    Rectangle {
        objectName: "page"
        anchors.fill: parent
        color: window.bg
    ColumnLayout {
        anchors.fill: parent
        spacing: 0

        // header: the name, and the theme
        RowLayout {
            Layout.fillWidth: true
            Layout.margins: 16
            Layout.leftMargin: window.wide ? 24 : 16
            Label {
                text: "Omi <font color=\"" + window.muted + "\">in Qt Quick</font>"
                textFormat: Text.RichText
                color: window.ink
                font { pixelSize: 15; bold: true }
            }
            Item { Layout.fillWidth: true }
            Row {
                Repeater {
                    model: [["", "Auto"], ["light", "Light"], ["dark", "Dark"]]
                    delegate: Chip {
                        required property var modelData
                        text: modelData[1]
                        on: window.theme === modelData[0]
                        onClicked: window.theme = modelData[0]
                    }
                }
            }
        }

        GridLayout {
            Layout.fillWidth: true
            Layout.fillHeight: true
            columns: window.wide ? 2 : 1
            columnSpacing: 0
            rowSpacing: 0

            // ---- Omi: beside the cards, or on top of them
            Item {
                id: stage
                Layout.fillWidth: true
                Layout.fillHeight: window.wide
                Layout.preferredHeight: window.wide ? -1 : 132
                Layout.preferredWidth: window.wide ? window.width / 2 : -1
                clip: !window.wide

                Rectangle {
                    anchors { left: parent.left; right: parent.right; bottom: parent.bottom }
                    height: 1
                    color: window.line
                    visible: !window.wide
                }

                GridLayout {
                    anchors.centerIn: parent
                    columns: window.wide ? 1 : 2
                    columnSpacing: 20
                    // room under Omi for props that hang below it (the
                    // download arrow), so they never reach its name
                    rowSpacing: window.wide ? omi.width * 0.1 + 8 : 14

                    Omi {
                        id: omi
                        Layout.alignment: Qt.AlignHCenter
                        Layout.preferredWidth: window.wide ? Math.min(380, stage.width - 80, stage.height - 220) : 112
                        Layout.preferredHeight: Layout.preferredWidth
                        color: window.omiColor
                        mode: window.started ? window.wanted : "logo"
                        // the plain logo first, then Omi comes to life
                        onLoaded: entrance.start()
                        Timer { id: entrance; interval: 600; onTriggered: window.started = true }
                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: { away.active(); window.poke(); }
                        }
                    }
                    Column {
                        Layout.alignment: window.wide ? Qt.AlignHCenter : Qt.AlignVCenter
                        spacing: 4
                        Label {
                            anchors.horizontalCenter: window.wide ? parent.horizontalCenter : undefined
                            text: window.nameOf(omi.showing)
                            color: window.ink
                            font { pixelSize: window.wide ? 20 : 17; bold: true }
                        }
                        Label {
                            anchors.horizontalCenter: window.wide ? parent.horizontalCenter : undefined
                            text: omi.label
                            color: window.muted
                            font.pixelSize: 13
                        }
                        Label {
                            visible: window.wide
                            topPadding: 12
                            width: 360
                            anchors.horizontalCenter: parent.horizontalCenter
                            horizontalAlignment: Text.AlignHCenter
                            wrapMode: Text.Wrap
                            text: "Omi watches the mouse. Click it or press Space for a reaction; ← → step through the modes. Try the cards: Omi follows along."
                            color: window.muted
                            font.pixelSize: 12
                        }
                    }
                }
            }

            // ---- the cards
            ScrollView {
                id: cards
                Layout.fillWidth: true
                Layout.fillHeight: true
                contentWidth: availableWidth
                clip: true

                ColumnLayout {
                    width: cards.availableWidth - (window.wide ? 24 : 32)
                    x: window.wide ? 0 : 16
                    spacing: 16

                    Item { implicitHeight: 4 }

                    // ---------------------------------------- talk to it
                    Card {
                        title: "Talk to it"
                        blurb: "Omi types along while you type, thinks when you send, and reacts to what you said."
                        id: talk
                        property var log: []
                        readonly property var replies: [
                            [/sudo/i, "sudo", "Nice try. Permission denied."],
                            [/love|<3|thank/i, "love", "Aw. Right back at you."],
                            [/ha(ha)+|lol|joke|funny/i, "laughing", "Ha! Good one."],
                            [/party|celebrat|birthday/i, "party", "Party time!"],
                            [/sad|sorry|miss|bad day/i, "crying", "Oh no. Here, have a virtual hug."],
                            [/angry|hate|stupid/i, "angry", "Hey! That's not nice."],
                            [/tile|tiling|hyprland|window/i, "tiling", "Everything in its place."],
                            [/wow|amazing|mind|blown|cool/i, "mind-blown", "I know, right?"],
                            [/cute|shy|pretty/i, "shy", "Stop it, you."],
                            [/hi|hello|hey/i, "wink", "Hi there! I'm Omi."],
                            [/\?$/, "skeptical", "Hmm. I'm a logo; I'd ask someone else."]
                        ]
                        function send(text) {
                            text = text.trim();
                            if (!text) return;
                            typing.stop();
                            log = log.concat([["me", text]]).slice(-4);
                            window.activity = "thinking";
                            think.reply = text;
                            think.restart();
                        }
                        Timer {
                            id: think
                            property string reply: ""
                            interval: 1400
                            onTriggered: {
                                const m = talk.replies.filter(function (r) { return r[0].test(think.reply); })[0]
                                      || [null, "excited", "Ooh, tell me more."];
                                window.activity = "";
                                omi.react(m[1]);
                                talk.log = talk.log.concat([["omi", m[2]]]).slice(-4);
                            }
                        }
                        Timer { id: typing; interval: 1200; onTriggered: if (window.activity === "typing") window.activity = "" }

                        Repeater {
                            model: talk.log
                            delegate: Rectangle {
                                required property var modelData
                                readonly property bool mine: modelData[0] === "me"
                                Layout.alignment: mine ? Qt.AlignRight : Qt.AlignLeft
                                Layout.maximumWidth: talk.width * 0.8
                                implicitWidth: said.implicitWidth + 24
                                implicitHeight: said.implicitHeight + 16
                                color: mine ? window.bg : "transparent"
                                border.color: mine ? window.line : window.omiColor
                                Label {
                                    id: said
                                    anchors.centerIn: parent
                                    width: Math.min(implicitWidth, talk.width * 0.8 - 24)
                                    text: (parent.mine ? "" : "<b><font color=\"" + window.omiColor + "\">Omi:</font></b> ") + parent.modelData[1].replace(/&/g, "&amp;").replace(/</g, "&lt;")
                                    textFormat: Text.StyledText
                                    wrapMode: Text.Wrap
                                    color: window.ink
                                    font.pixelSize: 13
                                }
                            }
                        }
                        RowLayout {
                            Layout.fillWidth: true
                            spacing: 8
                            Rectangle {
                                Layout.fillWidth: true
                                implicitHeight: 38
                                color: window.bg
                                border.color: input.activeFocus ? window.accent : window.line
                                TextInput {
                                    id: input
                                    anchors { fill: parent; leftMargin: 12; rightMargin: 12 }
                                    verticalAlignment: TextInput.AlignVCenter
                                    color: window.ink
                                    selectionColor: window.accent
                                    font.pixelSize: 13
                                    clip: true
                                    onTextEdited: {
                                        away.active();
                                        window.activity = text.trim() ? "typing" : "";
                                        typing.restart();
                                    }
                                    onAccepted: { talk.send(text); text = ""; }
                                    Label {
                                        anchors.verticalCenter: parent.verticalCenter
                                        text: "Say something to Omi"
                                        color: window.muted
                                        font.pixelSize: 13
                                        visible: !input.text && !input.activeFocus
                                    }
                                }
                            }
                            Btn { text: "Send"; primary: true; onClicked: { talk.send(input.text); input.text = ""; } }
                        }
                        Flow {
                            Layout.fillWidth: true
                            spacing: 6
                            Repeater {
                                model: ["hello!", "sudo make me a sandwich", "tell me a joke", "I love Omarchy", "let's party", "wow"]
                                delegate: Chip {
                                    required property string modelData
                                    text: modelData
                                    onClicked: talk.send(modelData)
                                }
                            }
                        }
                    }

                    // ---------------------------------------- move files
                    Card {
                        id: transfer
                        title: "Move files"
                        blurb: "A download (the kit itself, for real) and an upload (pretend), with Omi showing which way things go. Cancel one and it's sad."
                        property string doing: ""   // "download", "upload" or ""
                        property string file: ""
                        property real total: 0
                        property real progress: 0
                        property string status: "Idle."
                        function kb(n) { return Math.round(n / 1024) + " KB"; }
                        function start(mode, file, total) {
                            doing = mode;
                            transfer.file = file;
                            transfer.total = total;
                            progress = 0;
                            window.activity = mode;
                            // as long as Omi takes to morph there and play its loop twice
                            const p = omi.player;
                            run.duration = p ? Math.round(1000 * (p.kit.morph.duration + p.kit.morph.stagger + 2 * p.loopSeconds(mode))) : 8800;
                            run.restart();
                        }
                        function finish(cancelled) {
                            run.stop();
                            window.activity = "";
                            status = (cancelled ? "Cancelled " : "") + file + (cancelled ? "." : ": " + kb(total) + ", done.");
                            omi.react(cancelled ? "sad" : "success");
                            doing = "";
                            clear.restart();
                        }
                        NumberAnimation {
                            id: run
                            target: transfer
                            property: "progress"
                            from: 0
                            to: 1
                            onFinished: if (transfer.doing) transfer.finish(false)
                        }
                        Timer { id: clear; interval: 1200; onTriggered: transfer.progress = 0 }
                        onProgressChanged: if (doing)
                            status = (doing === "download" ? "Downloading " : "Uploading ") + file + ": " + kb(total * progress) + " of " + kb(total)

                        Flow {
                            Layout.fillWidth: true
                            spacing: 8
                            Btn {
                                text: "Download omi.json"
                                enabled_: !transfer.doing
                                onClicked: {
                                    const xhr = new XMLHttpRequest();
                                    xhr.onreadystatechange = function () {
                                        if (xhr.readyState === XMLHttpRequest.DONE)
                                            transfer.start("download", "omi.json", xhr.responseText.length || 170000);
                                    };
                                    xhr.open("GET", Qt.resolvedUrl("../../kit/omi.json"));
                                    xhr.send();
                                }
                            }
                            Btn {
                                text: "Upload photo.png"
                                enabled_: !transfer.doing
                                onClicked: transfer.start("upload", "photo.png", 2.4 * 1024 * 1024)
                            }
                            Btn { text: "Cancel"; visible: transfer.doing !== ""; onClicked: transfer.finish(true) }
                        }
                        Rectangle {
                            Layout.fillWidth: true
                            implicitHeight: 8
                            color: window.bg
                            border.color: window.line
                            Rectangle { width: parent.width * transfer.progress; height: parent.height; color: window.omiColor }
                        }
                        Label { text: transfer.status; color: window.muted; font.pixelSize: 12 }
                    }

                    // ---------------------------------------- omi in a button
                    Card {
                        title: "Omi in a button"
                        blurb: "Every Omi is its own item: here, one per button, telling you how the work went. One of these always works, one never does."
                        Flow {
                            Layout.fillWidth: true
                            spacing: 8
                            Repeater {
                                model: [["Save", "Saving…", "Saved", true], ["Deploy", "Deploying…", "Failed", false]]
                                delegate: Btn {
                                    id: work
                                    required property var modelData
                                    property string state_: "idle"   // idle, busy, done
                                    primary: modelData[3]
                                    text: state_ === "idle" ? modelData[0] : state_ === "busy" ? modelData[1] : modelData[2]
                                    enabled_: state_ === "idle"
                                    Omi {
                                        width: 26
                                        height: 26
                                        color: work.primary ? window.accentInk : window.omiColor
                                        bodyMotion: false
                                        mode: work.state_ === "busy" ? "thinking"
                                            : work.state_ === "done" ? (work.modelData[3] ? "success" : "warning") : "idle"
                                    }
                                    onClicked: { state_ = "busy"; busy.restart(); }
                                    Timer { id: busy; interval: 1600; onTriggered: { work.state_ = "done"; done.restart(); } }
                                    Timer { id: done; interval: work.modelData[3] ? 1800 : 2600; onTriggered: work.state_ = "idle" }
                                }
                            }
                        }
                    }

                    // ---------------------------------------- it notices
                    Card {
                        id: notices
                        title: "It notices"
                        blurb: "What the window knows, as Omi. They happen by themselves; Try shows one now."
                        property bool background: false
                        property bool idle: false
                        property bool tryBackground: false
                        property bool tryIdle: false
                        readonly property bool asleep: background || idle || tryBackground || tryIdle
                        onAsleepChanged: {
                            window.signalMode = asleep ? "sleeping" : "";
                            if (!asleep && window.started) omi.react("excited");
                        }
                        Connections {
                            target: window
                            function onActiveChanged() { notices.background = !window.active; }
                        }
                        Timer { id: tryOff; interval: 3500; onTriggered: { notices.tryBackground = false; notices.tryIdle = false; } }

                        Repeater {
                            model: [
                                ["background", "Window in the background", "Omi falls asleep, and is happy you're back"],
                                ["idle", "You, away for a minute", "Omi dozes off"]
                            ]
                            delegate: RowLayout {
                                required property var modelData
                                required property int index
                                readonly property bool on: notices[modelData[0]] || notices["try" + modelData[0][0].toUpperCase() + modelData[0].slice(1)]
                                Layout.fillWidth: true
                                spacing: 12
                                Rectangle {
                                    implicitWidth: 10
                                    implicitHeight: 10
                                    color: parent.on ? window.omiColor : "transparent"
                                    border.color: parent.on ? window.omiColor : window.muted
                                }
                                Column {
                                    Layout.fillWidth: true
                                    Label { text: modelData[1]; color: window.ink; font { pixelSize: 13; bold: true } }
                                    Label { text: modelData[2]; color: window.muted; font.pixelSize: 11 }
                                }
                                Btn {
                                    text: "Try"
                                    implicitHeight: 30
                                    onClicked: {
                                        if (index === 0) notices.tryBackground = true; else notices.tryIdle = true;
                                        tryOff.restart();
                                    }
                                }
                            }
                        }
                    }

                    // ---------------------------------------- every mode
                    Card {
                        title: "Every mode"
                        blurb: "Pick one: Omi morphs there from wherever it is."
                        Repeater {
                            model: {
                                // the kit's groups, in its order
                                const groups = [];
                                omi.modes.forEach(function (m) {
                                    if (m.id === "logo") return;
                                    const g = m.group || "Other";
                                    let found = groups.filter(function (x) { return x.name === g; })[0];
                                    if (!found) { found = { name: g, modes: [] }; groups.push(found); }
                                    found.modes.push(m);
                                });
                                return groups;
                            }
                            delegate: ColumnLayout {
                                required property var modelData
                                Layout.fillWidth: true
                                spacing: 6
                                Label {
                                    text: modelData.name.toUpperCase()
                                    color: window.muted
                                    font { pixelSize: 10; bold: true; letterSpacing: 1.2 }
                                }
                                Flow {
                                    Layout.fillWidth: true
                                    spacing: 6
                                    Repeater {
                                        model: modelData.modes
                                        delegate: Chip {
                                            required property var modelData
                                            text: modelData.name
                                            on: window.base === modelData.id
                                            onClicked: window.pick(modelData.id)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // ---------------------------------------- one color
                    Card {
                        title: "One color, any color"
                        blurb: "Omi is one color: bind it to your app's accent, or anything else."
                        Flow {
                            Layout.fillWidth: true
                            spacing: 10
                            Repeater {
                                model: ["", "#9ece6a", "#f7768e", "#e0af68", "#bb9af7", "#7dcfff"]
                                delegate: Rectangle {
                                    required property string modelData
                                    width: 30
                                    height: 30
                                    color: modelData || window.accent
                                    border.width: window.picked === modelData ? 2 : 1
                                    border.color: window.picked === modelData ? window.ink : window.line
                                    MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: window.picked = parent.modelData }
                                }
                            }
                            // any color
                            Rectangle {
                                width: 30
                                height: 30
                                gradient: Gradient {
                                    orientation: Gradient.Horizontal
                                    GradientStop { position: 0; color: "#f7768e" }
                                    GradientStop { position: 0.33; color: "#e0af68" }
                                    GradientStop { position: 0.66; color: "#9ece6a" }
                                    GradientStop { position: 1; color: "#7aa2f7" }
                                }
                                border.color: window.line
                                MouseArea { anchors.fill: parent; cursorShape: Qt.PointingHandCursor; onClicked: anyColor.open() }
                            }
                        }
                        ColorDialog {
                            id: anyColor
                            selectedColor: window.omiColor
                            onAccepted: window.picked = String(selectedColor)
                        }
                    }

                    // ---------------------------------------- put it in your app
                    Card {
                        title: "Put Omi in your app"
                        blurb: "Copy Omi.qml, and omi.js and omi.json from the kit, then:"
                        Rectangle {
                            Layout.fillWidth: true
                            implicitHeight: snippet.implicitHeight + 24
                            color: window.bg
                            border.color: window.line
                            TextEdit {
                                id: snippet
                                anchors { fill: parent; margins: 12 }
                                readOnly: true
                                selectByMouse: true
                                color: window.ink
                                selectionColor: window.accent
                                font { family: "monospace"; pixelSize: 12 }
                                wrapMode: TextEdit.Wrap
                                text: "Omi {\n    width: 200; height: 200\n    color: palette.highlight   // your accent\n    mode: \"thinking\"           // morphs there\n    look: [1, 0]               // the eyes, on top of any mode\n}\n\nomi.react(\"success\")          // then back to mode"
                            }
                        }
                        Btn {
                            text: copied.running ? "Copied" : "Copy"
                            onClicked: {
                                snippet.selectAll();
                                snippet.copy();
                                snippet.deselect();
                                copied.restart();
                                omi.react("wink");
                            }
                            Timer { id: copied; interval: 1600 }
                        }
                    }

                    Item { implicitHeight: 24 }
                }
            }
        }
    }

    }

    // You, away: a minute with no mouse or keys.
    QtObject {
        id: away
        function active() {
            notices.idle = false;
            idleTimer.restart();
        }
    }
    Timer { id: idleTimer; interval: 60000; running: true; onTriggered: notices.idle = true }
}
