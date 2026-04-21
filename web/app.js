/* -----------------------------------------------------------------
   Gyro → WebSocket phone controller
   ----------------------------------------------------------------- */

/* --- UI handles ------------------------------------------------- */
const wheel      = document.getElementById("wheel");
const throttleEl = document.getElementById("throttle");
const brakeEl    = document.getElementById("brake");
const statusEl   = document.getElementById("status");

/* helper to wire any on-screen button */
// haptic helper –  does nothing on browsers that don’t support vibration
const buzz = () => navigator.vibrate?.(20);   // 20 ms tap

/*****  rumble relay  *****/
function handleServerMsg(e) {
  try {
    const msg = JSON.parse(e.data);
    if ("rumble" in msg) {
      navigator.vibrate?.(msg.rumble);  // Android/Chrome vibrates; iOS ignores
    }
  } catch (_) {}                        // ignore non-JSON frames
}


function setupButton(el, key) {
  const press = (pressed) => {
    send({ btn: key, pressed });
    el.classList.toggle("down", pressed);
    if (pressed) buzz();
  };
  ["touchstart", "mousedown"].forEach((evt) =>
    el.addEventListener(evt, (e) => {
      e.preventDefault();
      press(true);
    }),
  );
  ["touchend", "touchcancel", "mouseup", "mouseleave"].forEach((evt) =>
    el.addEventListener(evt, () => press(false)),
  );
}

/* map ABXY + Start + Pause (already defined in HTML) */
["A", "B", "X", "Y", "Start", "Pause"].forEach((id) =>
  setupButton(document.getElementById("btn" + id), id.toUpperCase()),
);

/* -----------------------------------------------------------------
   STEERING PARAMETERS
   ----------------------------------------------------------------- */
const STEER_MAX_DEG = 30;   // hard clamp – don’t touch
const STEER_GAIN    = 2.0;  // 1.0 = old feel, >1 = more sensitive
/* ----------------------------------------------------------------- */

const setStatus = (txt) => (statusEl.textContent = txt);

/* --- WebSocket helpers ------------------------------------------ */
let ws;
function connectWS() {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${scheme}://${location.host}/ws`);
  ws.addEventListener("open", () => setStatus("🔌 WS connected"));
  ws.addEventListener("close", () => setStatus("❌ WS closed"));
  ws.addEventListener("error", () => setStatus("⚠️ WS error"));
  ws.addEventListener("message", handleServerMsg);
}
const send = (payload) =>
  ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify(payload));

/* --- Device-orientation steering -------------------------------- */
const STEER_CLAMP = STEER_MAX_DEG;     // alias for readability
let baseBeta = null,
  baseGamma = null;
let latestInput = { steer: 0, fwd: 0, back: 0 };
let lastSent = { steer: 0, fwd: 0, back: 0 };
const SEND_HZ = 120;
const EPS = 0.15;

window.addEventListener("deviceorientation", (e) => {
  if (e.beta == null || e.gamma == null) return;

  baseBeta ??= e.beta;
  baseGamma ??= e.gamma;

  const fwd = Math.max(0, e.beta - baseBeta);
  const back = Math.max(0, -e.beta + baseBeta);

  let steer = (e.gamma - baseGamma) * STEER_GAIN;
  steer = Math.max(-STEER_CLAMP, Math.min(STEER_CLAMP, steer)); // clamp

  /* --- update local UI --- */
  wheel.style.transform = `rotate(${steer}deg)`;
  throttleEl.style.height = `${(fwd / 30) * 100}%`;
  brakeEl.style.height = `${(back / 30) * 100}%`;

  latestInput = { steer, fwd, back };
});

setInterval(() => {
  const { steer, fwd, back } = latestInput;
  const changed =
    Math.abs(steer - lastSent.steer) > EPS ||
    Math.abs(fwd - lastSent.fwd) > EPS ||
    Math.abs(back - lastSent.back) > EPS;

  if (!changed) return;
  send({ steer, fwd, back });
  lastSent = { steer, fwd, back };
}, 1000 / SEND_HZ);

/* --- Permission gate (iOS/Android) ------------------------------ */
async function requestMotion() {
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") {
        setStatus("❌ Gyro permission denied");
        return;
      }
    } catch {
      setStatus("❌ Gyro permission error");
      return;
    }
  }
  connectWS();
  setStatus("📡 Tilt to drive!");
}

document.addEventListener("click", requestMotion, { once: true });
setStatus("👆 Tap once to enable gyro");
