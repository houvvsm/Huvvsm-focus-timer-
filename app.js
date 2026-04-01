/* ===============================
   HUVVSM FOCUS TIMER — app.js 
================================ */

document.addEventListener("DOMContentLoaded", () => {

  //  all DOM queries inside DOMContentLoaded
  const timeEl        = document.getElementById("time");
  const sessionsEl    = document.getElementById("sessions");
  const modeLabelEl   = document.getElementById("modeLabel");

  const startBtn      = document.getElementById("startBtn");
  const pauseBtn      = document.getElementById("pauseBtn");
  const resetBtn      = document.getElementById("resetBtn");
  const markBtn       = document.getElementById("markBtn");

  const lapsEl        = document.getElementById("laps");
  const modeBtns      = Array.from(document.querySelectorAll(".mode-btn"));

  const focusSettings    = document.getElementById("focusSettings");
  const focusMinutesInput = document.getElementById("focusMinutes");
  const saveFocusBtn     = document.getElementById("saveFocusBtn");
  const notifyBtn        = document.getElementById("notifyBtn");

  //  progress ring element
  const ringProgress  = document.getElementById("ringProgress");
  const RING_R        = 88;
  const RING_CIRCUM   = 2 * Math.PI * RING_R;

  //  pomodoro dots
  const pomoDots      = document.getElementById("pomoDots");
  const POMO_CYCLE    = 4;

  // toast element
  const toastEl       = document.getElementById("toast");

  //  preset buttons
  const presetBtns    = Array.from(document.querySelectorAll(".preset-btn"));

  /* Default durations (seconds) */
  const DURATIONS = {
    break: 5  * 60,
    long:  15 * 60,
  };

  const STORE_KEY = "huvvsm_timer_v5";

  /* ---- State ---- */
  let state = {
    mode:           "focus",
    focusDuration:  25 * 60,
    remaining:      25 * 60,
    elapsed:        0,
    laps:           [],
    savedRemaining: { focus: 25 * 60, break: 5 * 60, long: 15 * 60 },
    savedStopwatchElapsed: 0,
    sessions:       0,
    running:        false,
    lastTickAt:     null,
  };

  let intervalId = null;

  /* ===============================
     Helpers
  ================================ */

  function isStopwatch() { return state.mode === "stopwatch"; }

  function modeName(m) {
    return { focus: "Focus", break: "Break", long: "Long", stopwatch: "Stopwatch" }[m] ?? m;
  }

  function currentCountdownDuration(m) {
    if (m === "focus") return state.focusDuration;
    if (m === "break") return DURATIONS.break;
    if (m === "long")  return DURATIONS.long;
    return 0;
  }

  function formatTime(totalSeconds) {
    const s  = Math.max(0, Math.floor(totalSeconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const pad = n => String(n).padStart(2, "0");
    return hh > 0
      ? `${pad(hh)}:${pad(mm)}:${pad(ss)}`
      : `${pad(mm)}:${pad(ss)}`;
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function loadState() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    try {
      const p = JSON.parse(raw);
      if (!["focus","break","long","stopwatch"].includes(p.mode)) return;

      state.mode          = p.mode;
      state.focusDuration = Number(p.focusDuration) || 25 * 60;
      state.remaining     = Number(p.remaining);
      if (!Number.isFinite(state.remaining)) state.remaining = currentCountdownDuration(state.mode);
      state.elapsed       = Number(p.elapsed) || 0;
      state.laps          = Array.isArray(p.laps) ? p.laps : [];
      state.sessions      = Number(p.sessions) || 0;
      state.running       = Boolean(p.running);
      state.lastTickAt    = p.lastTickAt ? Number(p.lastTickAt) : null;

      if (p.savedRemaining && typeof p.savedRemaining === "object") {
        state.savedRemaining = {
          focus: Number(p.savedRemaining.focus),
          break: Number(p.savedRemaining.break),
          long:  Number(p.savedRemaining.long),
        };
      }
      if (!state.savedRemaining || !Number.isFinite(state.savedRemaining.focus)) {
        state.savedRemaining = {
          focus: state.focusDuration,
          break: DURATIONS.break,
          long:  DURATIONS.long,
        };
      }
      state.savedStopwatchElapsed = Number(p.savedStopwatchElapsed) || 0;
      state.savedRemaining.focus  = Math.min(state.savedRemaining.focus, state.focusDuration);
    } catch { /* ignore corrupt data */ }
  }

  /* ===============================
    Toast (replaces alert())
  ================================ */

  let toastTimer = null;

  function showToast(msg, type = "info", durationMs = 2600) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.className   = `toast toast--${type} toast--visible`;
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("toast--visible");
    }, durationMs);
  }

  /* ===============================
     Progress ring
  ================================ */

  function updateRing() {
    if (!ringProgress) return;

    if (isStopwatch()) {
      // Stopwatch: ring fills continuously (cycle every 60 s)
      const cycle = 60;
      const frac  = (state.elapsed % cycle) / cycle;
      ringProgress.style.strokeDashoffset = String(RING_CIRCUM * (1 - frac));
      ringProgress.style.stroke = "url(#ringGrad)";
      return;
    }

    const total = currentCountdownDuration(state.mode);
    const frac  = total > 0 ? Math.max(0, state.remaining / total) : 0;
    ringProgress.style.strokeDashoffset = String(RING_CIRCUM * (1 - frac));

    // Color shifts: green when plenty of time, amber when low, red when almost done
    if (frac > 0.5)       ringProgress.style.stroke = "url(#ringGrad)";
    else if (frac > 0.2)  ringProgress.style.stroke = "#f3c05a";
    else                   ringProgress.style.stroke = "#ff6070";
  }

  /* ===============================
     Pomodoro dots
  ================================ */

  function updatePomoDots() {
    if (!pomoDots) return;
    const dots = pomoDots.querySelectorAll(".pomo-dot");
    const filled = state.sessions % POMO_CYCLE;
    dots.forEach((d, i) => {
      d.classList.toggle("pomo-dot--filled", i < filled);
    });
  }

  /* ===============================
      document.title update
  ================================ */

  function updateDocTitle() {
    const timeStr = isStopwatch()
      ? formatTime(state.elapsed)
      : formatTime(state.remaining);
    const mode = modeName(state.mode);
    document.title = `${timeStr} — ${mode} | HUVVSM`;
  }

  /* ===============================
     UI
  ================================ */

  function renderLaps() {
    if (!lapsEl) return;
    //  keep Mark button in layout always; toggle visibility only
    lapsEl.style.display = isStopwatch() ? "flex" : "none";
    lapsEl.innerHTML = "";
    if (!isStopwatch()) return;

    state.laps.slice().reverse().forEach((lap, idx) => {
      const li  = document.createElement("li");
      const num = state.laps.length - idx;
      li.innerHTML = `<span>Mark <strong>#${num}</strong></span><strong>${formatTime(lap)}</strong>`;
      lapsEl.appendChild(li);
    });
  }

  function updateUI() {
    const displayTime = isStopwatch() ? formatTime(state.elapsed) : formatTime(state.remaining);
    timeEl.textContent = displayTime;

    sessionsEl.textContent  = state.sessions;
    modeLabelEl.textContent = modeName(state.mode);

    modeBtns.forEach(b => b.classList.toggle("active", b.dataset.mode === state.mode));

    startBtn.disabled = state.running;
    pauseBtn.disabled = !state.running;

    //  Mark button: always in layout, visibility toggled
    if (markBtn) {
      markBtn.classList.toggle("mark-btn--hidden", !isStopwatch());
      markBtn.disabled = !state.running || !isStopwatch();
    }

    // Focus settings hidden in stopwatch
    if (focusSettings) {
      focusSettings.style.display = isStopwatch() ? "none" : "flex";
    }

    // Sync focus minutes input (don't overwrite while typing)
    if (focusMinutesInput && document.activeElement !== focusMinutesInput) {
      focusMinutesInput.value = Math.round(state.focusDuration / 60);
    }

    updateRing();
    updatePomoDots();
    updateDocTitle();
    renderLaps();
  }

  /* ===============================
      Notifications + faded beep
  ================================ */

  async function ensureNotificationPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied")  return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  }

  function playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const o   = ctx.createOscillator();
      const g   = ctx.createGain();

      o.type            = "sine";
      o.frequency.value = 660;     // slightly mellower pitch
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      //  smooth fade-out instead of hard cut
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);

      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.6);
      setTimeout(() => ctx.close(), 800);
    } catch { /* ignore if blocked */ }
  }

  function notifyFocusDone() {
    playBeep();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("HUVVSM Timer", {
        body: `Focus finished ✅  Session #${state.sessions} done. Time for a break.`,
      });
    }
  }

  /* ===============================
     Timer engine
  ================================ */

  function stopInterval() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  function ensureIntervalRunning() {
    stopInterval();
    intervalId = setInterval(tick, 250);
  }

  function catchUp() {
    if (!state.running || !state.lastTickAt) return;
    const now            = Date.now();
    const elapsedSeconds = Math.floor((now - state.lastTickAt) / 1000);
    if (elapsedSeconds > 0) {
      if (isStopwatch()) state.elapsed   += elapsedSeconds;
      else               state.remaining -= elapsedSeconds;
      state.lastTickAt += elapsedSeconds * 1000;
    }
  }

  function onCountdownFinish() {
    if (state.mode === "focus") {
      state.sessions += 1;
      notifyFocusDone();
    }

    if (state.mode === "focus") {
      state.savedRemaining.focus = 0;
      state.mode      = "break";
      state.remaining = (Number.isFinite(state.savedRemaining.break) && state.savedRemaining.break > 0)
        ? state.savedRemaining.break
        : DURATIONS.break;
    } else {
      if (state.mode === "break") state.savedRemaining.break = 0;
      if (state.mode === "long")  state.savedRemaining.long  = 0;
      state.mode      = "focus";
      state.remaining = state.focusDuration;
    }

    state.lastTickAt = Date.now();
  }

  function tick() {
    catchUp();

    if (!isStopwatch() && state.remaining <= 0) {
      state.remaining = 0;
      onCountdownFinish();
    }

    if (isStopwatch()) state.savedStopwatchElapsed       = state.elapsed;
    else               state.savedRemaining[state.mode]  = state.remaining;

    saveState();
    updateUI();
  }

  function startTimer() {
    if (state.running) return;
    state.running    = true;
    state.lastTickAt = Date.now();
    saveState();
    updateUI();
    ensureIntervalRunning();
  }

  function pauseTimer() {
    if (!state.running) return;
    catchUp();
    state.running    = false;
    state.lastTickAt = null;
    if (isStopwatch()) state.savedStopwatchElapsed      = state.elapsed;
    else               state.savedRemaining[state.mode] = state.remaining;
    saveState();
    stopInterval();
    updateUI();
  }

  function resetTimer() {
    catchUp();
    if (isStopwatch()) {
      state.elapsed               = 0;
      state.laps                  = [];
      state.savedStopwatchElapsed = 0;
    } else {
      const def                          = currentCountdownDuration(state.mode);
      state.remaining                    = def;
      state.savedRemaining[state.mode]   = def;
    }
    if (state.running) state.lastTickAt = Date.now();

    //  brief visual flash on reset
    showToast(`${modeName(state.mode)} reset`, "info", 1400);

    saveState();
    updateUI();
  }

  /* ===============================
     Mode switching
  ================================ */

  function setMode(newMode) {
    if (!["focus","break","long","stopwatch"].includes(newMode)) return;
    const wasRunning = state.running;
    catchUp();

    if (isStopwatch()) state.savedStopwatchElapsed      = state.elapsed;
    else               state.savedRemaining[state.mode] = state.remaining;

    state.mode = newMode;

    if (newMode === "stopwatch") {
      state.elapsed = Number(state.savedStopwatchElapsed) || 0;
    } else {
      const def   = currentCountdownDuration(newMode);
      let   saved = state.savedRemaining[newMode];
      if (!Number.isFinite(saved)) saved = def;
      if (newMode === "focus") {
        saved = Math.min(saved, state.focusDuration);
        if (saved <= 0) saved = state.focusDuration;
      } else {
        if (saved <= 0) saved = def;
      }
      state.remaining = saved;
    }

    if (wasRunning) {
      state.running    = true;
      state.lastTickAt = Date.now();
      ensureIntervalRunning();
    } else {
      state.running    = false;
      state.lastTickAt = null;
    }

    saveState();
    updateUI();
  }

  /* ===============================
     Stopwatch mark
  ================================ */

  function markLap() {
    if (!isStopwatch() || !state.running) return;
    catchUp();
    state.laps.push(state.elapsed);
    saveState();
    updateUI();
  }

  /* ===============================
     Focus duration controls
  ================================ */

  function applyFocusDuration(mins) {
    if (!Number.isFinite(mins) || mins < 1 || mins > 180) {
      //  inline toast instead of alert()
      showToast("Choose between 1 – 180 minutes.", "error");
      if (focusMinutesInput) focusMinutesInput.value = Math.round(state.focusDuration / 60);
      return;
    }
    state.focusDuration              = Math.floor(mins * 60);
    state.savedRemaining.focus       = Math.min(state.savedRemaining.focus, state.focusDuration);
    if (focusMinutesInput) focusMinutesInput.value = mins;

    if (state.mode === "focus") {
      state.remaining = Math.min(state.remaining, state.focusDuration);
      if (state.remaining <= 0) state.remaining = state.focusDuration;
    }

    showToast(`Focus set to ${mins} min`, "success", 1600);
    saveState();
    updateUI();
  }

  function saveFocusDurationFromInput() {
    if (!focusMinutesInput) return;
    applyFocusDuration(Number(focusMinutesInput.value));
  }

  /* ===============================
     Boot
  ================================ */

  loadState();

  // Sync remaining with saved on boot
  if (state.mode === "stopwatch") {
    state.elapsed = Number(state.savedStopwatchElapsed) || state.elapsed || 0;
  } else {
    const def   = currentCountdownDuration(state.mode);
    let   saved = state.savedRemaining[state.mode];
    if (!Number.isFinite(saved)) saved = def;
    if (state.mode === "focus") {
      saved = Math.min(saved, state.focusDuration);
      if (saved <= 0) saved = state.focusDuration;
    } else {
      if (saved <= 0) saved = def;
    }
    state.remaining = saved;
  }

  // Catch up if it was running during refresh
  if (state.running && state.lastTickAt) {
    const now            = Date.now();
    const elapsedSeconds = Math.floor((now - state.lastTickAt) / 1000);
    if (elapsedSeconds > 0) {
      if (state.mode === "stopwatch") {
        state.elapsed               += elapsedSeconds;
        state.savedStopwatchElapsed  = state.elapsed;
      } else {
        state.remaining -= elapsedSeconds;
        if (state.remaining <= 0) {
          state.remaining = 0;
          onCountdownFinish();
        }
        state.savedRemaining[state.mode] = state.remaining;
      }
      state.lastTickAt = now;
    }
    ensureIntervalRunning();
  }

  saveState();
  updateUI();

  /* ===============================
     Events
  ================================ */

  startBtn.addEventListener("click", startTimer);
  pauseBtn.addEventListener("click", pauseTimer);
  resetBtn.addEventListener("click", resetTimer);
  if (markBtn) markBtn.addEventListener("click", markLap);

  modeBtns.forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

  if (saveFocusBtn) saveFocusBtn.addEventListener("click", saveFocusDurationFromInput);

  //  preset buttons
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      applyFocusDuration(Number(btn.dataset.mins));
    });
  });

  //  notifyBtn uses toast not alert()
  if (notifyBtn) {
    notifyBtn.addEventListener("click", async () => {
      const ok = await ensureNotificationPermission();
      showToast(
        ok ? "Alerts enabled ✅" : "Alerts blocked ❌ — check browser settings",
        ok ? "success" : "error",
        3000
      );
    });
  }

  //  keyboard shortcuts
  document.addEventListener("keydown", e => {
    // Ignore when typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    if (e.code === "Space") {
      e.preventDefault();
      state.running ? pauseTimer() : startTimer();
    } else if (e.key === "r" || e.key === "R") {
      resetTimer();
    } else if (e.key === "m" || e.key === "M") {
      markLap();
    }
  });

});
