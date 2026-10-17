# Every Omi mode

Omi has 30 modes, each a set of rectangles with a looping
animation, and it morphs from any one to any other. This page is made by
`node tools/modes-doc.js` from the kit, so it always matches
`kit/omi.json`; the stills are each mode at rest (time 0 of its loops),
drawn by the reference player.

![Every mode](modes/sheet.svg)

- **state or reaction** is what the mode is for (`kind` in the kit). A
  state stays as long as what it stands for lasts. A reaction is shown for
  its hold after its morph lands, then Omi goes back: `react("success")`
  in Omi.qml, or `omi.hold(mode)` in your own host.
- **loop** is how long the mode takes to play every piece's loop once
  (`loopSeconds`): show a mode at least that long in a tour.
- A **family** groups modes that mean the same thing: pick one per
  situation and treat the rest as variations. A mode marked `easter` is a
  joke: leave it out of anything generic.
- **A screen reader says** is the mode's `label` in the kit: the
  accessible name every app gives the picture, so Omi is announced the same
  way everywhere. It is each still's own name on this page.
- "Use it for" is advice for app authors; [docs/omarchy.md](omarchy.md)
  has the rules of thumb behind it (react to what the user did, never
  guilt the user, keep reactions short while they concentrate).

| | id | Name | Kind | Loop | A screen reader says | Use it for |
| --- | --- | --- | --- | --- | --- | --- |
| ![The Omarchy logo](modes/logo.svg) | `logo` | Logo | state | still | The Omarchy logo | The plain logo: a brand mark, and the entrance (set idle from it) |
| ![Omi](modes/idle.svg) | `idle` | Idle | state | 4 s | Omi | Nothing going on |
| ![Omi is thinking](modes/thinking.svg) | `thinking` | Thinking | state | 6 s | Omi is thinking | Checking, loading, waiting on the network (family: thinking) |
| ![Omi is thinking](modes/thinking-dots.svg) | `thinking-dots` | Thinking, dots | state | 4 s | Omi is thinking | A variation of thinking: three dots in the logo's gap (family: thinking) |
| ![Omi is downloading](modes/download.svg) | `download` | Download | state | 4 s | Omi is downloading | Downloading or installing (family: download) |
| ![Omi is downloading](modes/download-falling.svg) | `download-falling` | Download, falling | state | 4 s | Omi is downloading | A variation of download: the frame's sides falling (family: download) |
| ![Omi is uploading](modes/upload.svg) | `upload` | Upload | state | 4 s | Omi is uploading | Sending something away (family: upload) |
| ![Omi is uploading](modes/upload-rising.svg) | `upload-rising` | Upload, rising | state | 4 s | Omi is uploading | A variation of upload: the frame's sides rising (family: upload) |
| ![Omi is working](modes/working.svg) | `working` | Working | state | 1.5 s | Omi is working | Busy doing it for the user |
| ![Omi succeeded](modes/success.svg) | `success` | Success | reaction, 1.2 s | 1.6 s | Omi succeeded | Done, then back |
| ![Omi has a warning](modes/warning.svg) | `warning` | Warning | state | 4 s | Omi has a warning | Something needs a look, but nothing is broken |
| ![Omi is low on battery](modes/low-battery.svg) | `low-battery` | Low battery | state | 5 s | Omi is low on battery | The battery is low |
| ![Omi is asleep](modes/sleeping.svg) | `sleeping` | Sleeping | state | 4 s | Omi is asleep | Paused, put off until later, or the night light |
| ![Omi is typing](modes/typing.svg) | `typing` | Typing | state | 2.8 s | Omi is typing | The user is typing, or something is being written for them |
| ![Omi is listening](modes/listening.svg) | `listening` | Listening | state | 4 s | Omi is listening | Waiting for the user to press a key |
| ![Omi is laughing](modes/laughing.svg) | `laughing` | Laughing | reaction, 1.6 s | 0.7 s | Omi is laughing | A joke landed, then back |
| ![Omi is excited](modes/excited.svg) | `excited` | Excited | reaction, 1.8 s | 0.9 s | Omi is excited | Something good is about to happen (a theme picker, a download that's nearly done) |
| ![Omi loves it](modes/love.svg) | `love` | Love | reaction, 2 s | 1.2 s | Omi loves it | A favourite, a thank-you, then back |
| ![Omi winks](modes/wink.svg) | `wink` | Wink | reaction, 1.2 s | 4 s | Omi winks | A small aside, then back |
| ![Omi is shy](modes/shy.svg) | `shy` | Shy | reaction, 2 s | 6 s | Omi is shy | A compliment received, then back |
| ![Omi is confused](modes/confused.svg) | `confused` | Confused | state | 3.4 s | Omi is confused | Not sure what happened; a stall |
| ![Omi is skeptical](modes/skeptical.svg) | `skeptical` | Skeptical | state | 5 s | Omi is skeptical | Doubt: an odd input, an unusual request |
| ![Omi is sad](modes/sad.svg) | `sad` | Sad | state | 4 s | Omi is sad | Something was lost; never for a cancel or a skip (family: sad) |
| ![Omi is sad](modes/crying.svg) | `crying` | Crying | state | 1.2 s | Omi is sad | Something went badly; never to guilt the user (family: sad) |
| ![Omi is angry](modes/angry.svg) | `angry` | Angry | state | 2 s | Omi is angry | Blocked by something outside the user's control |
| ![Omi needs your password](modes/sudo.svg) | `sudo` | Sudo | state | 3.6 s | Omi needs your password | About to ask for a password |
| ![Omi is peeking in](modes/peek.svg) | `peek` | Peek | state | 4.5 s | Omi is peeking in | Looking in from the edge: a hint, a quick check-in |
| ![Omi is celebrating](modes/party.svg) | `party` | Party | state | 3.1 s | Omi is celebrating | A real milestone, like finishing setup |
| ![Omi is tiling windows](modes/tiling.svg) | `tiling` | Tiling | state | 3.7 s | Omi is tiling windows | Windows being arranged (the Omarchy tiling tutorial) |
| ![Omi’s mind is blown](modes/mind-blown.svg) | `mind-blown` | Mind blown | reaction, 2.4 s | 2.4 s | Omi’s mind is blown | Something impressive just happened, then back |
