# server/main.py
import math
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from pathlib import Path
import vgamepad as vg

app = FastAPI()
web_root = Path(__file__).parent.parent / "web"

@app.get("/")
def root():
    return HTMLResponse((web_root / "index.html").read_text())

@app.get("/{path:path}")
def static_files(path: str):
    file_path = web_root / path
    if file_path.is_file():
        return HTMLResponse(file_path.read_bytes(), media_type="text/plain")
    return HTMLResponse("Not found", status_code=404)

# --- Gamepad setup (Xbox 360 style) ------------------------------
gamepad = vg.VX360Gamepad()         # needs ViGEmBus running
STEER_RANGE = 30                    # deg from JS
TRIGGER_MAX = 255                   # RT/LT value

def set_controls(steer_deg: float, thrtl: float, brake: float):
    # Map ±STEER_RANGE° → analog stick X ±32767
    stick_x = int((steer_deg / STEER_RANGE) * 32767)
    stick_x = max(-32767, min(32767, stick_x))
    gamepad.left_joystick(x_value=stick_x, y_value=0)

    rt_val = int(thrtl/30 * TRIGGER_MAX)
    lt_val = int(brake/30 * TRIGGER_MAX)
    gamepad.right_trigger(value=rt_val)
    gamepad.left_trigger(value=lt_val)
    gamepad.update()

# --- WebSocket endpoint -----------------------------------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    print(f"[WS] Client connected: {ws.client}")

    try:
        while True:
            data = await ws.receive_json()
            steer   = data.get("steer", 0)
            throttle = data.get("fwd", 0)
            brake   = data.get("back", 0)

            # ▸▸▸ DEBUG: print incoming values
            print(f"Gyro packet → steer={steer:>5.1f}°  throttle={throttle:>5.1f}  brake={brake:>5.1f}")

            set_controls(steer, throttle, brake)

    except WebSocketDisconnect:
        print("[WS] Client disconnected – controls released")
        set_controls(0, 0, 0)

# Convenience dev server
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
