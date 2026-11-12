import { NextResponse } from "next/server";
import os from "os";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const interfaces = os.networkInterfaces();
    let lanIp = "127.0.0.1";

    // Find the first non-internal IPv4 address (e.g., Wi-Fi or Ethernet adapter)
    for (const name of Object.keys(interfaces)) {
      const netList = interfaces[name];
      if (!netList) continue;
      for (const net of netList) {
        if (net.family === "IPv4" && !net.internal) {
          // Prefer typical Wi-Fi / LAN address ranges
          if (
            net.address.startsWith("192.168.") ||
            net.address.startsWith("10.") ||
            net.address.startsWith("172.")
          ) {
            lanIp = net.address;
            break;
          }
        }
      }
      if (lanIp !== "127.0.0.1") break;
    }

    const port = process.env.PORT || "3000";
    const lanUrl = `http://${lanIp}:${port}`;
    const configuredBaseUrl = process.env.NEXT_PUBLIC_QR_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";

    return NextResponse.json({
      lanIp,
      port,
      lanUrl,
      configuredBaseUrl,
      productionUrl: "https://food-delivery-app-b7e0b.web.app",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to resolve network IP" },
      { status: 500 }
    );
  }
}

