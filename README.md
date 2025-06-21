# Gyro-Controller

Turn any Android handset into a steering wheel for PC racers.
This repo contains:

server/ – FastAPI bridge that converts phone‑gyroscope data → virtual Xbox 360 gamepad (via ViGEmBus).

web/ – Single‑page web client that streams motion sensors over a secure WebSocket.

Works on Windows 10/11 and with the client running on Android phone, tested with Forza Horizon 5 and Assetto Corsa.

---

## Demo



## 1  Prerequisites

| Component | Purpose | Quick install |
|-----------|---------|---------------|
| **ViGEmBus** driver | Presents a virtual Xbox 360 controller to Windows | Download & run the signed installer from <https://vigembus.com/download>, then **reboot**. Verify: `sc query ViGEmBus` → `STATE : 4  RUNNING`. |
| **Python 3.10+** | Runs the FastAPI bridge | <https://www.python.org/downloads/> (check **“Add Python to PATH”**). |
| **OpenSSL** | Creates a self-signed TLS certificate | Included with Git-for-Windows (`C:\Program Files\Git\usr\bin\openssl.exe`).<br/>If missing: `choco install openssl`. |

---

## 2  Clone the repository & install Python dependencies

```powershell
cd C:\Tools\        # choose any folder
git clone https://github.com/your-repo/gyro-controller.git
cd gyro-controller

python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
````

---

## 3  Generate a self-signed certificate (run once)

```powershell
# run at repo root (gyro-controller\)
openssl req -x509 -newkey rsa:2048 -nodes `
  -keyout key.pem -out cert.pem -days 365 `
  -subj "/CN=localhost"
```

Resulting structure:

```
gyro-controller\
├── key.pem
├── cert.pem
├── server\
│   └── main.py
└── web\
    └── index.html
```

---

## 4  Start the server (HTTPS)

```powershell
uvicorn server.main:app --host 0.0.0.0 --port 8000 ^
       --ssl-keyfile ..\key.pem --ssl-certfile ..\cert.pem
```

* Accept the Windows Firewall prompt (allow on private networks).
* The console should display startup information with no errors.

The server is now listening securely on port 8000 and ready to accept WebSocket connections.


## 5  Connect your phone

1. Ensure PC and phone are on the **same Wi‑Fi** network (cellular won’t work).
2. Open the printed link (e.g. `https://192.168.1.42:8000`) in **Chrome/Safari**.
   Accept the self‑signed‑certificate warning.
3. Tap once → grant the **Motion & Orientation** permission.
4. Tilt to drive! Blue bar = throttle, red = brake.

Games will now see a standard Xbox 360 pad (left‑stick X + triggers).

---

## 6  Troubleshooting 🔧

| Symptom                                                                 | Cause                                                                                   | Fix                                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **“AssertionError: The virtual device could not connect to ViGEmBus.”** | ViGEmBus service missing or stopped.                                                    | Start the service with `sc start ViGEmBus` (or reinstall & reboot if the service is missing).                                               |
| Game/Windows doesn’t detect the controller                              | ViGEmBus device not created or firewall blocks connection.                              | Make sure `uvicorn` prints “Controller connected”, allow app through Windows Defender, and launch the game **after** the bridge is running. |
| Browser status icon shows <s>ws</s> crossed out                         | Page was opened via **http\://** but WebSocket upgraded to **wss\://** (mixed content). | Always browse with `https://…` and use the same host/port that `uvicorn` prints.                                                            |
| Phone says **“Gyroscope permission denied”**                            | iOS/Android rejected the request.                                                       | Reload the page, ensure you tapped once and answered the dialog. Safari requires the first tap be user‑initiated.                           |
| Console shows `GET /app.js 304` but the page is blank                   | `web/` folder not found relative to `server/`, or wrong working directory.              | Start `uvicorn` from the repo root or adjust `web_root` in `main.py`.                                                                       |
| **ERR\_SSL\_PROTOCOL\_ERROR** in phone browser                          | Certificate/key mismatch or wrong port.                                                 | Regenerate `key.pem` / `cert.pem`, confirm both paths, and use the same port in the URL.                                                    |
| Wi‑Fi captive‑portal page appears                                       | Phone thinks the certificate is a login page.                                           | Add a DNS entry or bookmark, or click *“Continue anyway”* then refresh.                                                                     |
| Sensors freeze after the screen locks                                   | Mobile OS suspends JS when the tab is in the background.                                | Disable auto‑lock, keep the screen on (Android Chrome flag or iOS Guided Access).                                                           |

---




