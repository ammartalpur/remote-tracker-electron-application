import { contextBridge, ipcRenderer } from "electron";

let activeAppListener: any = null;
console.log("Preload loaded!");
contextBridge.exposeInMainWorld("electronAPI", {
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),
  getMacAddress: () => ipcRenderer.invoke("get-mac-address"),
  getNetworkLocation: () => ipcRenderer.invoke("get-network-location"),

  // 🚀 Expose the new initializer
  initializeAgent: (token: string, deviceId: string) =>
    ipcRenderer.invoke("initialize-agent", { token, deviceId }),

  startCaptureEngine: (deviceId: string) =>
    ipcRenderer.invoke("start-capture-engine", deviceId),

  onActiveAppChanged: (callback: (appName: string) => void) => {
    if (activeAppListener) {
      ipcRenderer.removeListener("active-app-changed", activeAppListener);
    }

    activeAppListener = (_event: any, appName: string) => {
      console.log("App name From main.ts", appName);
      callback(appName);
    };

    ipcRenderer.on("active-app-changed", activeAppListener);
  },
});
