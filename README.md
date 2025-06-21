
# Gyro-Controller

This guide covers everything needed to spin up the WebSocket + virtual-gamepad server on a fresh Windows machine.  Client devices and game configuration are documented separately.

---

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

