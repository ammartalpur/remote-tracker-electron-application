import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

declare global {
  interface Window {
    electronAPI: {
      getSystemInfo: () => Promise<{
        hostname: string;
        os: string;
        arch: string;
      }>;
      getMacAddress: () => Promise<string>;
    };
  }
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
