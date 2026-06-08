import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getPreciseLocation } from "../lib/hardware";

// 🚀 UPDATED: Using your Cloudflare URL
const SERVER_URL = "http://localhost:4000";

export type AgentStatus =
  | "connecting"
  | "awaiting_approval"
  | "waiting_admin_approval"
  | "verified";

export function useAgentSocket(hardware: any) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<AgentStatus>("connecting");
  const [otp, setOtp] = useState<string | null>(null);

  useEffect(() => {
    if (!hardware || !hardware.macAddress) return;

    const token = localStorage.getItem("agent_token");
    const deviceId = localStorage.getItem("agent_deviceId");

    let newSocket: Socket;

    // 🚀 UPDATED: secure: false is safer for Cloudflare Tunnels
    const socketOptions = {
      transports: ["websocket"],
      secure: false,
    };

    if (token && deviceId) {
      newSocket = io(SERVER_URL, {
        ...socketOptions,
        auth: { type: "agent", token, deviceId },
      });

      newSocket.on("connect", () => setStatus("verified"));

      if ((window as any).electronAPI?.onActiveAppChanged) {
        (window as any).electronAPI.onActiveAppChanged((appName: string) => {
          newSocket.emit("agent:update_app", { deviceId, appName });
        });
      }

      newSocket.on("agent:request_capture", async () => {
        try {
          const base64Image = await (
            window as any
          ).electronAPI.takeScreenshot();
          if (base64Image) {
            newSocket.emit("agent:capture_result", {
              deviceId,
              image: base64Image,
            });
          }
        } catch (error) {
          console.error("🌐 [Socket] Screenshot error:", error);
        }
      });

      newSocket.on("auth_error", () => {
        localStorage.clear();
        window.location.reload();
      });
    } else {
      newSocket = io(SERVER_URL, {
        ...socketOptions,
        auth: { type: "agent" },
      });

      newSocket.on("connect", async () => {
        setStatus("awaiting_approval");
        console.log("🟢 Socket connected! Fetching precise location data...");

        const locationData = await getPreciseLocation();

        newSocket.emit("agent:request_pairing", {
          hostname: hardware.hostname,
          os: hardware.os,
          macAddress: hardware.macAddress,
          ip: locationData.ip,
          location: locationData.location,
        });
      });

      newSocket.on("agent:receive_otp", (data: { otp: string }) =>
        setOtp(data.otp),
      );
      newSocket.on("pairing_error", (res: { message: string }) =>
        alert(res.message),
      );
      newSocket.on("pairing_status", (res: { status: string }) => {
        if (res.status === "waiting_admin_approval")
          setStatus("waiting_admin_approval");
      });

      newSocket.on("pairing_response", (response: any) => {
        if (response.success) {
          localStorage.setItem("agent_token", response.token);
          localStorage.setItem("agent_deviceId", response.deviceId);
          newSocket.disconnect();
          window.location.reload();
        } else {
          alert(response.message || "Pairing failed.");
        }
      });
    }

    newSocket.on("connect_error", (err) => {
      console.error("❌ [Socket Connection Error]:", err.message);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [hardware]);

  const submitOtp = useCallback(
    (enteredOtp: string) => {
      if (socket && hardware?.macAddress) {
        socket.emit("agent:submit_otp", {
          macAddress: hardware.macAddress,
          otp: enteredOtp,
        });
      }
    },
    [socket, hardware],
  );

  return { socket, status, otp, submitOtp };
}
