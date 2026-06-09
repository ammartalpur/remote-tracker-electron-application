import { contextBridge, ipcRenderer } from "electron";

let activeAppListener: any = null;
console.log("Preload loaded!");

contextBridge.exposeInMainWorld("electronAPI", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
  getMacAddress: () => ipcRenderer.invoke("get-mac-address"),
  getNetworkLocation: () => ipcRenderer.invoke("get-network-location"),

  initializeAgent: (token: string, deviceId: string) =>
    ipcRenderer.invoke("initialize-agent", { token, deviceId }),

  // Keep this if you still use it for something else
  startCaptureEngine: (deviceId: string) =>
    ipcRenderer.invoke("start-capture-engine", deviceId),

  // 🚀 ADD THIS NEW BLOCK RIGHT HERE
  startHistoryLoop: (deviceId: string) => {
    console.log(
      "🌉 [Preload] startHistoryLoop called with deviceId:",
      deviceId,
    );
    return ipcRenderer.invoke("start-history-loop", deviceId);
  },

  onActiveAppChanged: (callback: (appName: string) => void) => {
    if (activeAppListener) {
      ipcRenderer.removeListener("active-app-changed", activeAppListener);
    }

    activeAppListener = (_event: any, appName: string) => {
      callback(appName);
    };

    ipcRenderer.on("active-app-changed", activeAppListener);
  },
});
