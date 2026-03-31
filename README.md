# HUVVSM focus Timer

A neon glass focus timer with Pomodoro countdown, stopwatch, per-mode progress memory, and persistent state across refreshes.

---

## Features

- **Focus / Break / Long countdown modes** — each mode remembers its own progress independently. Switching modes never resets another mode's timer.
- **Stopwatch mode** — with lap marks, scrollable lap history, and time display.
- **SVG progress ring** — a live arc around the timer face that depletes as the countdown runs and shifts color from cyan → amber → red as time runs low.
- **Pomodoro session dots** — four dots below the ring track your focus sessions. Every 4 sessions signals time for a long break.
- **Custom focus duration** — set via number input or one-click quick-preset buttons (15m / 25m / 45m / 60m).
- **Auto mode switching** — Focus finishes → automatically switches to Break. Break/Long finishes → automatically switches back to Focus.
- **Persistent state** — everything is saved to `localStorage`. Refresh the page and the timer picks up exactly where it left off, including catch-up for time that passed while the tab was closed.
- **Browser notifications + beep** — get an alert and a soft audio tone when a focus session ends (requires one-time permission grant).
- **Keyboard shortcuts** — `Space` to start/pause, `R` to reset, `M` to mark a lap.
- **Live browser tab title** — the tab always shows the current time and mode (e.g. `18:42 — Focus | HUVVSM`).
- **Inline toast notifications** — all feedback (alerts enabled, focus set, reset confirmation) appears as styled toasts inside the UI, no native `alert()` dialogs.

---

## File Structure

```
huvvsm-timer/
├── index.html    — markup, layout, all element IDs
├── app.js        — all timer logic, state, events
└── style.css     — neon glass design system, animations, responsive
```

No build step. No dependencies. No npm. Drop the three files in any folder and open `index.html` in a browser.

---

## How to Use

### Basic countdown

1. Select a mode — **Focus**, **Break**, or **Long** — from the top button bar.
2. Hit **Start**. The ring depletes and the tab title updates live.
3. Hit **Pause** to freeze, **Start** again to resume.
4. **Reset** resets only the current mode, not the others.

### Setting focus duration

- Click one of the quick preset buttons — **15m**, **25m**, **45m**, **60m** — to set the focus timer instantly.
- Or type a custom value (1–180 minutes) into the input field and hit **Save**.
- The change takes effect immediately even if the timer is running.

### Stopwatch

1. Switch to **Stopwatch** mode.
2. Hit **Start** to begin counting up.
3. Hit **Mark** (or press `M`) to record a lap timestamp. Laps appear in a scrollable list below the controls, newest first.
4. Hit **Reset** to clear elapsed time and all laps.

### Notifications

Click **Enable Alerts** to request browser notification permission. After that, a desktop notification and a soft beep fire automatically when a Focus session ends.

### Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / Pause |
| `R` | Reset current mode |
| `M` | Mark a lap (Stopwatch only) |

Shortcuts are ignored while typing in the focus duration input.

---

## Pomodoro Pattern

The four dots below the ring track focus sessions within a cycle of 4.

| Sessions completed | Recommendation |
|--------------------|----------------|
| 1–3 | Take a short **Break** (5 min default) |
| 4 | Take a **Long** break (15 min default) |

The app auto-switches between Focus and Break when a timer finishes. After a Long break, it returns to Focus and the dot cycle resets.

---

## Persistence & Refresh Behavior

All state is stored in `localStorage` under the key `huvvsm_timer_v5`. On every page load the app:

1. Reads saved state.
2. Calculates how many seconds passed since the last tick timestamp.
3. Applies that time delta to whichever mode was active.
4. Resumes running automatically if it was running before the refresh.

This means closing and reopening the tab works correctly — the timer counts correctly for the time it was away, including handling a session that finished while the tab was closed.

To fully reset everything (all modes, all sessions, all laps), open the browser console and run:

```js
localStorage.removeItem("huvvsm_timer_v5");
location.reload();
```

---

## Browser Support

Works in any modern browser that supports:

- CSS `backdrop-filter`
- SVG `stroke-dashoffset` animation
- `localStorage`
- `Web Audio API` (for the beep — gracefully silenced if blocked)
- `Notification API` (for desktop alerts — gracefully skipped if denied)

Tested in Chrome, Firefox, and Safari. The `backdrop-filter` blur effect requires Chrome/Edge/Safari; Firefox renders the card without blur but everything else works.

---

## Design System

The visual language is defined entirely through CSS custom properties in `:root`:

| Variable | Value | Purpose |
|----------|-------|---------|
| `--c1` | `#5af3ff` | Cyan — primary accent |
| `--c2` | `#8b5cff` | Violet — secondary accent |
| `--txt` | `#e9f2ff` | Primary text |
| `--muted` | `rgba(233,242,255,0.72)` | Subdued text |
| `--glass` | `rgba(255,255,255,0.06)` | Glass panel fill |
| `--stroke` | `rgba(255,255,255,0.12)` | Glass panel border |

Fonts: **Orbitron** (timer, title, primary button) and **Rubik** (all other text) — both loaded from Google Fonts.

---

## Customization

**Change default durations** — edit the constants at the top of `app.js`:

```js
const DURATIONS = {
  break: 5  * 60,   // 5 minutes
  long:  15 * 60,   // 15 minutes
};
// Focus default is state.focusDuration = 25 * 60
```

**Change the Pomodoro cycle length** — edit this constant in `app.js`:

```js
const POMO_CYCLE = 4;  // sessions before a long break
```

**Change colors** — update `--c1` and `--c2` in `style.css` `:root`. The ring gradient, glow effects, active states, and preset buttons all inherit from these two variables automatically.

---

## Credits

Built by HUVVSM. Neon glass design system, timer engine, and all logic are original.
