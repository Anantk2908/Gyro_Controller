/* web/app.js  */

////////////////////  tiny UI helper  ////////////////////
const statusEl = document.getElementById("status");
const status   = txt => (statusEl.textContent = txt);

////////////////////  WebSocket helpers  //////////////////
let ws;
function connectWS() {
  // Pick the correct scheme for the current page
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${scheme}://${location.host}/ws`);

  ws.addEventListener("open",  () => status("🔌 WS connected"));
  ws.addEventListener("close", () => status("❌ WS closed"));
  ws.addEventListener("error", () => status("⚠️ WS error"));
}

function send(payload) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

////////////////////  Gyro handling  //////////////////////
const STEER_MAX_DEG = 30;
let baseBeta = null;
let baseGamma = null;

window.addEventListener("deviceorientation", e => {
  if (e.beta == null || e.gamma == null) return;   // sensor unavailable/blocked

  if (baseBeta === null)  baseBeta  = e.beta;
  if (baseGamma === null) baseGamma = e.gamma;

  const fwd  = Math.max(0,  e.beta - baseBeta);
  const back = Math.max(0, -e.beta + baseBeta);

  let steer = e.gamma - baseGamma;
  steer = Math.max(-STEER_MAX_DEG, Math.min(STEER_MAX_DEG, steer));

  send({ steer, fwd, back });
});

////////////////////  Permission gate  ////////////////////
async function requestMotionPermission() {
  // Needed on iOS (and some Android ROMs)
  if (typeof DeviceOrientationEvent?.requestPermission === "function") {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== "granted") {
        status("❌ Gyro permission denied");
        return;
      }
    } catch (err) {
      status("❌ Gyro permission error");
      return;
    }
  }

  connectWS();          // open WebSocket only after sensors allowed
  addEventListener("📡 Tilt to drive!");
}

////////////////////  Kick-off (wait for a tap)  ///////////
document.addEventListener("click", requestMotionPermission, { once: true });
status("👆 Tap once to enable gyro");
