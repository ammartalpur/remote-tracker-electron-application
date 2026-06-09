import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { getPreciseLocation } from "../lib/hardware";

const SERVER_URL = "https://remote-tracker-server-production.up.railway.app";

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

    const socketOptions = {
      transports: ["websocket"],
      secure: false,
    };

    if (token && deviceId) {
      // ==========================================
      // 1. RETURNING USER FLOW
      // ==========================================
      newSocket = io(SERVER_URL, {
        ...socketOptions,
        auth: { type: "agent", token, deviceId },
      });

      newSocket.on("connect", () => {
        setStatus("verified");

        if ((window as any).electronAPI?.initializeAgent) {
          (window as any).electronAPI
            .initializeAgent(token, deviceId)
            .then(() => {
              console.log("✅ Main process agent initialized");

              // 🚀 CRITICAL FIX: Restart the history loop for returning users
              if ((window as any).electronAPI.startHistoryLoop) {
                console.log(
                  "🌐 [Frontend] Calling startHistoryLoop for returning session...",
                );
                (window as any).electronAPI
                  .startHistoryLoop(deviceId)
                  .then(() =>
                    console.log(
                      "✅ [Frontend] startHistoryLoop promise resolved!",
                    ),
                  )
                  .catch((err: any) =>
                    console.error(
                      "❌ [Frontend] startHistoryLoop IPC failed:",
                      err,
                    ),
                  );
              }
            })
            .catch((err: any) =>
              console.error("❌ initializeAgent failed:", err),
            );
        }
      });

      if ((window as any).electronAPI?.onActiveAppChanged) {
        (window as any).electronAPI.onActiveAppChanged((appName: string) => {
          newSocket.emit("agent:update_app", { deviceId, appName });
        });
      }

      newSocket.on("auth_error", () => {
        localStorage.clear();
        window.location.reload();
      });
    } else {
      // ==========================================
      // 2. NEW USER / PAIRING FLOW
      // ==========================================
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

      // 🚀 CONSOLIDATED PAIRING RESPONSE
      newSocket.on("pairing_response", (res: any) => {
        if (res.success) {
          localStorage.setItem("agent_token", res.token);
          localStorage.setItem("agent_deviceId", res.deviceId);

          console.log("🚀 Attempting to initialize agent...");

          if (
            (window as any).electronAPI &&
            (window as any).electronAPI.initializeAgent
          ) {
            (window as any).electronAPI
              .initializeAgent(res.token, res.deviceId)
              .then(() => {
                console.log("✅ Agent initialized successfully!");

                if ((window as any).electronAPI.startHistoryLoop) {
                  console.log(
                    "🌐 [Frontend] Calling startHistoryLoop after new pairing...",
                  );
                  (window as any).electronAPI
                    .startHistoryLoop(res.deviceId)
                    .then(() =>
                      console.log(
                        "✅ [Frontend] startHistoryLoop promise resolved!",
                      ),
                    )
                    .catch((err: any) =>
                      console.error(
                        "❌ [Frontend] startHistoryLoop IPC failed:",
                        err,
                      ),
                    );
                }
              })
              .catch((err: any) => console.error("❌ IPC call failed:", err));
          }

          newSocket.disconnect();

          // Re-enable this reload so the UI updates from "Pairing" to "Verified"
          window.location.reload();
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
