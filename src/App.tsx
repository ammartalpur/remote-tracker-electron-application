import React, { useEffect, useState } from "react";
import { useAgentSocket } from "./hooks/useAgentSocket";

export default function App() {
  const [hardware, setHardware] = useState<any>(null);
  const [otpInput, setOtpInput] = useState(""); // NEW: State for the input box

  useEffect(() => {
    const loadHardware = async () => {
      const info = await (window as any).electronAPI.getSystemInfo();
      const macAddress = await (window as any).electronAPI.getMacAddress();
      const network = await (window as any).electronAPI.getNetworkLocation();

      setHardware({
        ...info,
        macAddress,
        publicIp: network.ip,
        location: network.location,
      });
    };
    loadHardware();
  }, []);

  const { status, submitOtp } = useAgentSocket(hardware);

  if (!hardware)
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Scanning Hardware...
      </div>
    );

  return (
    <div className="flex flex-col h-screen bg-slate-50 p-6 items-center justify-center">
      {status === "awaiting_approval" && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-orange-200 w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">
            Awaiting Approval
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            Ask your administrator for the 5-digit OTP to pair this device.
          </p>

          {/* NEW: OTP Input Form */}
          <div className="flex flex-col gap-3 mt-4">
            <input
              type="text"
              maxLength={5}
              placeholder="Enter OTP"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              className="w-full text-center text-2xl tracking-widest font-mono border border-slate-300 rounded-lg p-3 outline-none focus:border-indigo-500"
            />
            <button
              onClick={() => submitOtp(otpInput)}
              disabled={otpInput.length < 5}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 transition-colors"
            >
              Verify Connection
            </button>
          </div>
        </div>
      )}

      {status === "verified" && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-emerald-200 w-full max-w-sm text-center">
          <h1 className="text-xl font-bold text-emerald-600 mb-2">
            Connection Secured
          </h1>
          <p className="text-sm text-slate-500 mb-4">
            Background telemetry is active.
          </p>
        </div>
      )}
    </div>
  );
}
