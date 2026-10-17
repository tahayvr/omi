#!/usr/bin/env bash
# Omi in a terminal, with nothing but bash, jq and awk: no Node, no Python.
# omi.awk is the player; this script reads the kit, sets up the terminal
# and feeds the player its clock, keys and mouse.
#
#   examples/bash/omi.sh                  Omi, live: a tour of every mode, the
#                                         eyes on the mouse, keys to play
#   examples/bash/omi.sh --once warning   print one still and exit
#   examples/bash/omi.sh --once idle --say "Welcome back"
#
# Live, ← → step through the modes, Space or a click on Omi plays a
# reaction, b turns whole-body motion on and off, t stops or starts the
# tour, q quits. Left alone off the tour, Omi falls asleep.
#
# Options:
#   --size 44      pixels across, a multiple of 22 so Omi stays crisp;
#                  default: as big as fits (44 with --once)
#   --fg '#9ece6a' Omi's color; default: the Omarchy theme's accent, or the
#                  terminal's own foreground
#   --bg '#1a1b26' the color faded pixels blend into; default: the Omarchy
#                  theme's background, or the terminal's own (it asks)
#   --bounce       whole-body motion (bobs, hops), off by default: at
#                  terminal sizes it moves a pixel at a time
#   --say "text"   with --once, text beside Omi
#
# Bash 4 or later keeps exact time (EPOCHREALTIME); older ones (macOS's 3.2)
# count each frame as 1/30 s, so Omi runs a little slow there.
set -u
export LC_ALL=C # bytes in, bytes out, and a dot in the clock's decimals

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
kit=${OMI_KIT:-$here/../../kit/omi.json}
for tool in jq awk; do
  command -v "$tool" >/dev/null || { echo "omi.sh needs $tool." >&2; exit 1; }
done

once="" size="" fg="" bg="" bounce=0 say="" rects=0
while (($#)); do
  case $1 in
    --once) once=${2:?--once needs a mode}; shift ;;
    --size) size=${2:?}; shift ;;
    --fg) fg=${2:?}; shift ;;
    --bg) bg=${2:?}; shift ;;
    --say) say=${2:?}; shift ;;
    --bounce) bounce=1 ;;
    --rects) rects=1 ;; # for tools/check-bash.js: "<mode> <seconds>" lines in, rects out
    -h | --help) sed -n '2,/^set -u/p' "$0" | sed '$d; s/^# \{0,1\}//'; exit 0 ;;
    *) echo "omi.sh: no option $1 (see --help)" >&2; exit 1 ;;
  esac
  shift
done

# ------------------------------------------------------------------ colors
# "#rrggbb" to "r g b"
rgb() {
  [[ $1 =~ ^#[0-9a-fA-F]{6}$ ]] || return 1
  printf '%d %d %d' "0x${1:1:2}" "0x${1:3:2}" "0x${1:5:2}"
}
theme=$HOME/.local/state/omarchy/current/theme/colors.toml
themed() {
  [[ -r $theme ]] && sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*\"\(#[0-9a-fA-F]\{6\}\)\".*/\1/p" "$theme" | head -n 1
}
fg=$(rgb "$fg" || rgb "$(themed accent)" || true)
bg=$(rgb "$bg" || rgb "$(themed background)" || true)

# ------------------------------------------------------------------ the kit
# Flattened to one tab-separated line per thing, for awk (see omi.awk).
flat=$(mktemp)
fifos=()
cleanup_files() { rm -f "$flat" ${fifos[@]+"${fifos[@]}"}; }
trap cleanup_files EXIT
jq -r '
  def j: map(tostring) | join(",");
  "G\t\(.grid)",
  "V\t\(.view | map(tostring) | join("\t"))",
  "M\t\(.morph.duration)\t\(.morph.stagger)\t\(.morph.ease | j)\t\(.morph.center[0])\t\(.morph.center[1])\t\(.morph.splitReach)\t\(.morph.rolePenalty)",
  (.gaze // empty | "Z\t\(.reach[0])\t\(.reach[1])\t\(.duration)\t\(.ease | j)\t\((.inside // [0,0,0,0]) | map(tostring) | join("\t"))\t\(.roles | join(","))"),
  (.animations | to_entries[] | .key as $n | .value as $a |
    "A\t\($n)\t\($a.duration)\t\($a.rest // 0)\t\(if ($a.ease | type) == "array" then ($a.ease | j) else $a.ease end)",
    ($a.keys | to_entries[] | .key as $i | .value[0] as $p | .value[1] | to_entries[] |
      "K\t\($n)\t\($i)\t\($p)\t\(.key)\t\(if (.value | type) == "array" then "@\(.value[0])*\(.value[1])" else .value end)")),
  (.modes[] | . as $m |
    "O\t\(.id)\t\(.kind // "state")\t\(.hold // "")\t\(.name)\t\(.label // .name)\t\(.group // "")\t\(.bounds | j)\t\(.anim // "")\t\(if .clip then ([.clip.x, .clip.y, .clip.w, .clip.h, (.clip.anim // "")] | j) else "" end)",
    (.pieces[] | "P\t\($m.id)\t\(.x)\t\(.y)\t\(.w)\t\(.h)\t\(.role)\t\(.opacity // 1)\t\(.anim // "")\t\(.delay // 0)\t\(.duration // "")\t\(if .clip then 1 else 0 end)\t\(.mx // 0)\t\(.my // 0)\t\(.dx // 0)\t\(.dy // 0)"))
' "$kit" >"$flat" || exit 1

player() { awk -v kitfile="$flat" -v size="$size" -v fg="$fg" -v bg="$bg" -v bounce="$bounce" "$@" -f "$here/omi.awk"; }

if ((rects)); then
  player -v rects=1
  exit
fi

# ------------------------------------------------------------------ --once
if [[ -n $once ]]; then
  if [[ -z $say ]]; then
    player -v once="$once" </dev/null
    exit
  fi
  # the text beside Omi, centered on its height
  still=$(player -v once="$once" </dev/null) || exit
  n=$(printf '%s\n' "$still" | wc -l)
  printf '%s\n' "$still" | awk -v n="$n" -v say="$say" '
    { top = int(n / 2); printf "%s", $0; if (NR == top) printf "  \033[1m%s\033[0m", say; print "" }'
  exit
fi

# ------------------------------------------------------------------ live
[[ -t 0 && -t 1 ]] || { echo "Live Omi needs a terminal. Try --once." >&2; exit 1; }

saved=$(stty -g </dev/tty)
pids=()
cleanup() {
  ((${#pids[@]})) && kill "${pids[@]}" 2>/dev/null
  printf '\e[?1003l\e[?1006l\e[?1004l\e[0m\e[?25h\e[?1049l'
  stty "$saved" </dev/tty
  cleanup_files
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# keys one at a time, no echo; Ctrl+C still stops it
stty -echo -icanon min 1 time 0 </dev/tty

# Ask the terminal for its colors (OSC 10, 11) when the theme gave none, so
# faded pixels blend into the real background. The device-attributes query
# after them is answered by every terminal, so the wait ends at its "c".
if [[ -z $fg || -z $bg ]]; then
  printf '\e]10;?\e\\\e]11;?\e\\\e[c' >/dev/tty
  IFS= read -rs -d c -t 1 reply </dev/tty || reply=""
  term_color() {
    [[ $reply =~ $'\e'\]$1\;rgba?:([0-9a-fA-F]+)/([0-9a-fA-F]+)/([0-9a-fA-F]+) ]] || return 1
    local out="" h
    for h in "${BASH_REMATCH[@]:1:3}"; do
      out+="$(((16#$h * 255 + (16 ** ${#h} - 1) / 2) / (16 ** ${#h} - 1))) "
    done
    echo "${out% }"
  }
  [[ -z $fg ]] && fg=$(term_color 10 || true)
  [[ -z $bg ]] && bg=$(term_color 11 || true)
fi

# Full screen, no cursor, the mouse reported (any motion, SGR) and focus.
printf '\e[?1049h\e[?25l\e[?1003h\e[?1006h\e[?1004h'

# Two pipes: events for the player (ticks, keys, the size), and "ready"
# from it after each frame, so the clock only ticks as fast as it draws.
events=$(mktemp -u) ready=$(mktemp -u)
mkfifo "$events" "$ready"
fifos=("$events" "$ready")
exec 4<>"$events" 3<>"$ready"

size_event() { stty size </dev/tty | { read -r r c && echo "size $c $r"; }; }
size_event >&4

# the keyboard and the mouse, a byte at a time
while IFS= read -rsn1 -d '' ch </dev/tty; do
  printf 'key %d\n' "'$ch"
done >&4 &
pids+=($!)

# the clock: a tick after each frame, about 30 a second, and the size when
# the window changes
(
  trap size_event WINCH
  echo >&3
  while read -r -u 3 _; do
    sleep 0.03
    echo "tick ${EPOCHREALTIME:--}"
  done
) >&4 &
pids+=($!)

player -v ready="$ready" <&4
