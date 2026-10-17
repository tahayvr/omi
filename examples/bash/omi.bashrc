# Omi follows your shell. Source this from ~/.bashrc, after any other prompt
# setup (starship, direnv…), since it has to run last:
#
#   source ~/omi/examples/bash/omi.bashrc
#
# A command that runs longer than OMI_AFTER seconds (2) makes the shared Omi
# busy (thinking); when it ends, Omi is happy (success) or sad for a moment,
# then idle again. A command stopped with Ctrl+C just goes back to idle.
# Every app showing the shared Omi follows: the Omarchy plugin, the terminal
# example with --follow, your own. It needs the Omi service running (see
# service/README.md) and socat or nc to reach it; without them it does nothing.
#
#   omi thinking        set the shared Omi by hand
#   omi laughing 2      for 2 seconds, then back to idle
#
# Settings, before sourcing:
#   OMI_AFTER=2         seconds before a command counts as long
#   OMI_BUSY=thinking   the mode while one runs (working, download…)
#   OMI_GREET="Hi"      print Omi with this beside it as the shell starts
#                       (examples/bash/omi.sh --once)

[[ $- == *i* ]] || return 0

: "${OMI_AFTER:=2}" "${OMI_BUSY:=thinking}"
__omi_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)

# Where the service listens: $OMI_SOCKET, $XDG_RUNTIME_DIR/omi.sock, or a
# per-user file in the temporary directory (see protocol/README.md).
__omi_socket() {
  if [[ -n ${OMI_SOCKET-} ]]; then echo "$OMI_SOCKET"
  elif [[ -n ${XDG_RUNTIME_DIR-} ]]; then echo "$XDG_RUNTIME_DIR/omi.sock"
  else echo "${TMPDIR:-/tmp}/omi-$(id -u).sock"
  fi
}
# Send one message, in the background so the prompt never waits for it.
__omi_send() {
  local sock
  sock=$(__omi_socket)
  [[ -S $sock ]] || return 0
  if command -v socat >/dev/null; then
    (printf '%s\n' "$1" | socat -t 1 - "UNIX-CONNECT:$sock" >/dev/null 2>&1 &)
  elif command -v nc >/dev/null; then
    (printf '%s\n' "$1" | nc -U -w 1 "$sock" >/dev/null 2>&1 &)
  fi
}
# omi <mode> [seconds]: set the shared Omi, for that long then idle
omi() {
  [[ -n ${1-} ]] || { echo "usage: omi <mode> [seconds]" >&2; return 1; }
  if [[ -n ${2-} ]]; then
    __omi_send "{\"type\":\"set\",\"mode\":\"$1\",\"for\":$2,\"then\":\"idle\"}"
  else
    __omi_send "{\"type\":\"set\",\"mode\":\"$1\"}"
  fi
}

# Before a command (the DEBUG trap) and after it (PROMPT_COMMAND). Only the
# first simple command of a line starts the timer; the prompt's own commands
# are ignored, from __omi_status, the first, to __omi_prompt, the last.
__omi_armed=0 __omi_running=0 __omi_code=0 __omi_start=0 __omi_timer=""
__omi_before() {
  if [[ $BASH_COMMAND == __omi_status ]]; then __omi_armed=0; return; fi
  ((__omi_armed)) || return
  [[ -n ${COMP_LINE-} ]] && return # tab completion
  __omi_armed=0 __omi_running=1 __omi_start=$SECONDS
  # busy once the command has run OMI_AFTER seconds; __omi_prompt stops
  # this if it ends sooner ({ … } 2>/dev/null hides the job's number)
  { (sleep "$OMI_AFTER" && omi "$OMI_BUSY") & } 2>/dev/null
  __omi_timer=$!
  disown "$__omi_timer" 2>/dev/null
}
__omi_status() { __omi_code=$?; return $__omi_code; }
__omi_prompt() {
  if ((__omi_running)); then
    __omi_running=0
    kill "$__omi_timer" 2>/dev/null
    if ((SECONDS - __omi_start >= OMI_AFTER)); then
      case $__omi_code in
        0) omi success 2 ;;
        130) omi idle ;;
        *) omi sad 3 ;;
      esac
    fi
  fi
  __omi_armed=1
  return $__omi_code
}
__omi_pc=${PROMPT_COMMAND-}
while [[ $__omi_pc == *[\;\ ] ]]; do __omi_pc=${__omi_pc%?}; done
PROMPT_COMMAND="__omi_status${__omi_pc:+;$__omi_pc};__omi_prompt"
unset __omi_pc
trap __omi_before DEBUG

if [[ -n ${OMI_GREET-} ]]; then
  "$__omi_dir/omi.sh" --once idle --size 22 --say "$OMI_GREET" 2>/dev/null
fi
