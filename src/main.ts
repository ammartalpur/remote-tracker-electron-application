import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  session,
} from "electron";
import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs";
import started from "electron-squirrel-startup";
import {
  getSystemInfo,
  getMacAddress,
  getNetworkLocation,
} from "./lib/hardware";
import { io, Socket } from "socket.io-client";

if (started) app.quit();

// Configuration
const API_BASE_URL = "http://localhost:4000/api/capture";
const SERVER_URL = "http://localhost:4000";
let captureInterval: NodeJS.Timeout | null = null;
let currentDeviceId: string | null = null;
let agentSocket: Socket | null = null;

// Logger Setup
const logFile = path.join(app.getPath("userData"), "debug.log");
const log = (...args: any[]) => {
  const message = args
    .map((a) => (typeof a === "object" ? JSON.stringify(a) : a))
    .join(" ");
  console.log(message);
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${message}\n`);
};

// Core Capture Engine
async function executeAutomatedCapture(deviceId: string) {
  log("📸 [Pipeline] Starting screen capture...");
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
    });
    if (sources.length === 0) {
      log("❌ [Pipeline] Aborted: No displays detected.");
      return;
    }

    const imageBuffer = sources[0].thumbnail.toJPEG(80);

    const presignRes = await fetch(`${API_BASE_URL}/request-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    });

    const { uploadUrl, fileName } = await presignRes.json();
    await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: imageBuffer,
    });
    await fetch(`${API_BASE_URL}/confirm-upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId, fileName }),
    });
    log("✅ [Pipeline] Success!");
  } catch (error) {
    log("❌ [Pipeline] Error:", error);
  }
}

// Socket Initialization
function initializeAgent(token: string, deviceId: string) {
  if (agentSocket) agentSocket.disconnect();
  currentDeviceId = deviceId;

  agentSocket = io(SERVER_URL, {
    transports: ["websocket"],
    auth: { type: "agent", token, deviceId },
  });

  agentSocket.on("connect", () => log("🟢 Agent Socket Connected"));
  agentSocket.on("agent:capture_now", () => {
    log("📸 [Socket] Received manual capture command!");
    if (currentDeviceId) executeAutomatedCapture(currentDeviceId);
  });
}

// Window Management
const createWindow = (ActiveWindow: any) => {
  const mainWindow = new BrowserWindow({
    width: 450,
    height: 600,
    resizable: false,
    title: "Remote Tracker Agent",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL)
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  else
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );

if (ActiveWindow) {
  let lastApp = "Desktop";
  
  const debounceTimer: NodeJS.Timeout | null = null;

const watchId = ActiveWindow.subscribe((windowInfo: any) => {
  if (!windowInfo?.application) return;

  if (windowInfo.application !== lastApp) {
    lastApp = windowInfo.application;

    if (!mainWindow.isDestroyed()) {
      console.log("Sending IPC:", lastApp);

      // 1. Electron renderer IPC (your local UI)
      mainWindow.webContents.send("active-app-changed", lastApp);

      // 2. Backend socket (YOUR DASHBOARD)
      if (agentSocket && currentDeviceId) {
        agentSocket.emit("employee:app_changed", {
          deviceId: currentDeviceId,
          activeApp: lastApp,
        });
      }
    }
  }
});

  mainWindow.on("closed", () => {
    ActiveWindow.unsubscribe(watchId);
    if (debounceTimer) clearTimeout(debounceTimer);
  });
}
};

// Lifecycle
app.on("ready", () => {
  session.defaultSession.setPermissionRequestHandler((_, perm, cb) =>
    cb(perm === "geolocation"),
  );
  try {
    const modulePath = app.isPackaged
      ? path.join(process.resourcesPath, "active-window")
      : path.join(app.getAppPath(), "node_modules/@paymoapp/active-window");
    const require = createRequire(modulePath + "/package.json");
    const ActiveWindow =
      require(modulePath).ActiveWindow ?? require(modulePath).default;
    ActiveWindow.initialize();
    createWindow(ActiveWindow);
  } catch (e) {
    createWindow(null);
  }
});

// IPC Handlers
ipcMain.handle("initialize-agent", (event, { token, deviceId }) => {
  initializeAgent(token, deviceId);
  return { success: true };
});

ipcMain.handle("start-capture-engine", (event, deviceId: string) => {
  if (captureInterval) return { success: true };
  currentDeviceId = deviceId;
  executeAutomatedCapture(deviceId);
  captureInterval = setInterval(() => executeAutomatedCapture(deviceId), 60000);
  return { success: true };
});

ipcMain.handle("get-system-info", () => getSystemInfo());
ipcMain.handle("get-mac-address", () => getMacAddress());
ipcMain.handle("get-network-location", () => getNetworkLocation());

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
