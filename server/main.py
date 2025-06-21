
import asyncio
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
import vgamepad as vg

BUTTON_MAP = {
    "A":      vg.XUSB_BUTTON.XUSB_GAMEPAD_A,
    "B":      vg.XUSB_BUTTON.XUSB_GAMEPAD_B,
    "X":      vg.XUSB_BUTTON.XUSB_GAMEPAD_X,
    "Y":      vg.XUSB_BUTTON.XUSB_GAMEPAD_Y,
    "START":  vg.XUSB_BUTTON.XUSB_GAMEPAD_START,   # ▶ button
    "PAUSE":  vg.XUSB_BUTTON.XUSB_GAMEPAD_BACK,    # ⏸ button
    "L":      vg.XUSB_BUTTON.XUSB_GAMEPAD_LEFT_SHOULDER,
    "R":      vg.XUSB_BUTTON.XUSB_GAMEPAD_RIGHT_SHOULDER,
}

app = FastAPI()

# --------- Paths ---------
web_root = Path(__file__).parent.parent / "web"

# --------- Virtual game‑pad ---------
gamepad = vg.VX360Gamepad()           # Requires ViGEmBus service
connected_ws: set[WebSocket] = set()         # keep track of phones
main_loop: asyncio.AbstractEventLoop | None = None     
STEER_RANGE = 22                      # ± degrees from device
TRIGGER_MAX = 255                   # Analogue trigger range


# ------------------ FASTAPI start-up ------------------------------
@app.on_event("startup")
async def grab_loop():
    global main_loop
    main_loop = asyncio.get_running_loop()     

# ------------------ RUMBLE callback -------------------------------
async def _broadcast_rumble(duration: int):
    for ws in list(connected_ws):
        if ws.application_state.name == "CONNECTED":
            await ws.send_json({"rumble": duration})

def rumble_callback(client, target, large_motor, small_motor, led_number, user_data):
    intensity = max(large_motor, small_motor) / 65535.0
    duration  = int(20 + 100 * intensity)

    if main_loop is not None:
        asyncio.run_coroutine_threadsafe(
            _broadcast_rumble(duration), main_loop       # ← CHANGED
        )

gamepad.register_notification(rumble_callback)


def set_controls(steer_deg: float, throttle: float, brake: float) -> None:
    """Map gyro data → virtual Xbox 360 controls."""
    # Left stick X axis for steering
    stick_x = int((steer_deg / STEER_RANGE) * 32767)
    stick_x = max(-32767, min(32767, stick_x))
    gamepad.left_joystick(x_value=stick_x, y_value=0)

    # RT == throttle, LT == brake
    rt_val = int(throttle / 30 * TRIGGER_MAX)
    lt_val = int(brake    / 30 * TRIGGER_MAX)
    gamepad.right_trigger(value=rt_val)
    gamepad.left_trigger(value=lt_val)

    gamepad.update()

# --------- WebSocket endpoint ---------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_ws.add(ws)

    # throttle vGamepad updates to 30 Hz
    import time
    last_send = 0.0
    TARGET_DT = 1 / 60

    try:
        while True:
            data      = await ws.receive_json()
            steer     = data.get("steer", 0.0)
            throttle  = data.get("fwd",   0.0)
            brake     = data.get("back",  0.0)

            now = time.perf_counter()
            if now - last_send >= TARGET_DT:
                set_controls(steer, throttle, brake)
                last_send = now

            # button handling (unchanged)
            btn = data.get("btn")
            if btn is not None and btn in BUTTON_MAP:
                if data.get("pressed"):
                    gamepad.press_button(BUTTON_MAP[btn])
                else:
                    gamepad.release_button(BUTTON_MAP[btn])

    except WebSocketDisconnect:
        set_controls(0, 0, 0)
    finally:
        connected_ws.discard(ws)

# --------- Static assets ---------
# Mounting AFTER the WebSocket route ensures /ws goes to the correct handler.
app.mount("/", StaticFiles(directory=web_root, html=True), name="static")

# --------- CLI entry point ---------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server.main:app",
                host="0.0.0.0",
                port=8000,
                reload=False,
                ssl_keyfile="key.pem",
                ssl_certfile="cert.pem")