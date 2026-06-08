import os from "os";

export function getSystemInfo() {
  return {
    hostname: os.hostname(),
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
  };
}

export function getMacAddress(): string {
  const networkInterfaces = os.networkInterfaces();
  for (const name of Object.keys(networkInterfaces)) {
    const netInterface = networkInterfaces[name];
    if (!netInterface) continue;
    for (const net of netInterface) {
      if (
        !net.internal &&
        net.family === "IPv4" &&
        net.mac !== "00:00:00:00:00:00"
      ) {
        return net.mac;
      }
    }
  }
  return "UNKNOWN-MAC";
}

// Fetches the real Public IP and City/Country mapping
export async function getNetworkLocation() {
  try {
    // 1. Swap to IPWhois (Reliable, no key needed for basic usage, rarely blocked)
    const response = await fetch("https://ipwhois.app/json/", {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error("IPWhois API rejected the request.");

    const data = await response.json();
    console.log(data);
    // IPWhois uses data.country instead of data.country_name
    return {
      ip: data.ip || "Unknown IP",
      location:
        data.city && data.country
          ? `${data.city}, ${data.country}`
          : "Unknown Location",
    };
  } catch (error) {
    console.log("IPWhois API timed out (ISP block). Triggering fallback...");

    // 2. The Bulletproof Fallback: ipify.org (IP Address Only)
    try {
      const fallbackRes = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(5000),
      });
      const fallbackData = await fallbackRes.json();
      const dataOfApi = {
        ip: fallbackData.ip || "Local Network",
        location: "Location Restricted by Network",
      };
      console.log(dataOfApi);
      return dataOfApi;
    } catch (fallbackError) {
      console.log("Both APIs blocked. Defaulting to safe offline values.");
      return { ip: "Offline/Local", location: "Offline/Local" };
    }
  }
}

// export async function getNetworkLocation() {
//     return {
//       ip:  "Unknown IP",
//       location:
//         "Unknown Location",
//     };
// }

export async function getPreciseLocation() {
  return new Promise(async (resolve) => {
    // 1. Check if the OS/Browser even supports location
    if (!("geolocation" in navigator)) {
      console.log("📍 Geolocation unsupported. Falling back to IP...");
      return resolve(await getNetworkLocation()); // Your existing IP function
    }

    // 2. Ask the OS for the exact coordinates
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`📍 Exact Coordinates: ${latitude}, ${longitude}`);

        try {
          // 3. Convert coordinates to a real-world address (Free OpenStreetMap API)
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          );

          if (!res.ok) throw new Error("Reverse geocoding failed");

          const data = await res.json();

          // Nominatim returns various address details depending on the area
          const city =
            data.address.city ||
            data.address.town ||
            data.address.village ||
            data.address.county;
          const country = data.address.country;

          resolve({
            ip: await getJustMyIP(), // You can write a tiny fetch to ipify just to grab the IP string
            location: `${city}, ${country} (Precise OS)`,
          });
        } catch (error) {
          console.error("📍 Failed to read city name from coordinates.");
          // If the text translation fails, just send the raw GPS math!
          resolve({
            ip: "Unknown",
            location: `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
          });
        }
      },
      async (error) => {
        // 4. THE FALLBACK: If the PC has no Wi-Fi card or denies the request
        console.warn(
          `📍 OS Location Failed (${error.message}). Falling back to IP tracking...`,
        );
        resolve(await getNetworkLocation()); // Run your existing IPWhois fallback
      },
      {
        enableHighAccuracy: true, // Force Wi-Fi triangulation instead of cached cell towers
        timeout: 10000,
        maximumAge: 0,
      },
    );
  });
}

// A tiny helper just to grab the IP if the GPS succeeds
async function getJustMyIP() {
  try {
    const res = await fetch("https://api.ipify.org?format=json");
    const data = await res.json();
    return data.ip;
  } catch (e) {
    return "Unknown IP";
  }
}