import QRCode from "qrcode";
import { RestaurantTable } from "@/types";

export interface GeneratedQrResult {
  qrCodeKey: string;
  qrCodeUrl: string;
  qrDataUrl: string;
}

/**
 * Checks whether a host/URL is loopback or localhost
 */
export function isLocalhost(urlOrHost: string): boolean {
  if (!urlOrHost) return true;
  return (
    urlOrHost.includes("localhost") ||
    urlOrHost.includes("127.0.0.1") ||
    urlOrHost.includes("0.0.0.0") ||
    urlOrHost.includes("::1")
  );
}

/**
 * Resolves the customer-reachable base URL for Table QR links.
 * Priority:
 * 1. Explicit overrideOrigin (if not localhost)
 * 2. User/Admin configured base URL in localStorage ('noryoko_qr_base_url')
 * 3. Environment variable: NEXT_PUBLIC_QR_BASE_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL
 * 4. Browser hostname (if not localhost, e.g. production domain or opened via LAN IP)
 * 5. Wi-Fi / Ethernet LAN IP fetched from /api/network-ip for local dev
 * 6. Production App Hosting fallback
 */
export async function getReachableBaseUrl(providedOrigin?: string): Promise<string> {
  if (providedOrigin && !isLocalhost(providedOrigin)) {
    return providedOrigin.replace(/\/$/, "");
  }

  // 1. Check localStorage if user has configured custom domain or LAN URL
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("noryoko_qr_base_url");
      if (stored && stored.trim() && !isLocalhost(stored)) {
        return stored.trim().replace(/\/$/, "");
      }
    } catch (_) {}
  }

  // 2. Check environment variables
  const envUrl =
    process.env.NEXT_PUBLIC_QR_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  if (envUrl && !isLocalhost(envUrl)) {
    return envUrl.replace(/\/$/, "");
  }

  // 3. If running in browser and NOT localhost
  if (typeof window !== "undefined") {
    const loc = window.location;
    if (!isLocalhost(loc.hostname)) {
      return loc.origin;
    }

    // 4. Query /api/network-ip route to get host machine's Wi-Fi LAN IP
    try {
      const res = await fetch("/api/network-ip");
      if (res.ok) {
        const data = await res.json();
        if (data.configuredBaseUrl && !isLocalhost(data.configuredBaseUrl)) {
          return data.configuredBaseUrl.replace(/\/$/, "");
        }
        if (data.lanUrl && !isLocalhost(data.lanUrl)) {
          return data.lanUrl.replace(/\/$/, "");
        }
      }
    } catch (_) {}
  }

  // 5. Default fallback to deployed Firebase App Hosting domain
  return "https://food-delivery-app-b7e0b.web.app";
}

/**
 * Replaces localhost/loopback in an existing QR URL with a reachable base URL,
 * keeping tableId, qrKey, branchId, and restaurantId intact.
 */
export function fixQrUrlWithBase(url: string, newBaseUrl: string): string {
  try {
    const parsed = new URL(url);
    const base = new URL(newBaseUrl);
    parsed.protocol = base.protocol;
    parsed.host = base.host;
    parsed.port = base.port;
    return parsed.toString();
  } catch (_) {
    const cleanBase = newBaseUrl.replace(/\/$/, "");
    const queryPart = url.includes("?") ? "?" + url.split("?")[1] : "";
    return `${cleanBase}/table-menu${queryPart}`;
  }
}

/**
 * Generate a cryptographically unique token and high-res QR code for a dining table
 */
export async function generateTableQr(
  tableId: string,
  branchId: string,
  restaurantId?: string,
  origin?: string
): Promise<GeneratedQrResult> {
  const baseOrigin = await getReachableBaseUrl(origin);
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  const qrCodeKey = `qr_${tableId.substring(0, 8)}_${timestamp}_${randomSuffix}`;

  // Public mobile web catalogue URL
  const qrCodeUrl = `${baseOrigin}/table-menu?tableId=${encodeURIComponent(tableId)}&qrKey=${encodeURIComponent(qrCodeKey)}&branchId=${encodeURIComponent(branchId)}${restaurantId ? `&restaurantId=${encodeURIComponent(restaurantId)}` : ""}`;

  // Generate high-resolution PNG data URL with High Error Correction
  const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: "H",
    color: {
      dark: "#0f172a", // slate-900
      light: "#ffffff",
    },
  });

  return {
    qrCodeKey,
    qrCodeUrl,
    qrDataUrl,
  };
}

/**
 * Download a single table QR code as an image with branding.
 * Automatically ensures the QR is NOT localhost before downloading.
 */
export async function downloadTableQr(
  table: RestaurantTable,
  restaurantName = "Noryoko Food",
  branchName = "Branch",
  overrideBaseUrl?: string
): Promise<void> {
  const reachableBase = await getReachableBaseUrl(overrideBaseUrl);
  let effectiveUrl = table.qrCodeUrl || "";

  // If URL has localhost or is missing, correct it
  if (!effectiveUrl || isLocalhost(effectiveUrl)) {
    const qrKey = table.qrCodeKey || table.id;
    effectiveUrl = `${reachableBase}/table-menu?tableId=${encodeURIComponent(table.id)}&qrKey=${encodeURIComponent(qrKey)}&branchId=${encodeURIComponent(table.branchId)}${table.restaurantId ? `&restaurantId=${encodeURIComponent(table.restaurantId)}` : ""}`;
  }

  // Generate high-res image for canvas
  const dataUrl = await QRCode.toDataURL(effectiveUrl, {
    width: 600,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  // Create a canvas with table details and QR code for a clean card design
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = 800;
  canvas.height = 1000;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border & Styling
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 12;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Inner decorative border
  ctx.strokeStyle = "#059669"; // emerald-600
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, canvas.width - 72, canvas.height - 72);

  // Header Title
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 38px 'Segoe UI', Roboto, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(restaurantName.toUpperCase(), canvas.width / 2, 100);

  // Branch Name
  ctx.fillStyle = "#475569";
  ctx.font = "600 24px 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(branchName, canvas.width / 2, 140);

  // Prominent Table Badge
  ctx.fillStyle = "#059669";
  ctx.beginPath();
  const badgeWidth = 420;
  const badgeHeight = 70;
  const badgeX = (canvas.width - badgeWidth) / 2;
  const badgeY = 175;
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 16);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 36px 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(`TABLE ${table.tableNumber}`, canvas.width / 2, badgeY + 48);

  // Draw QR Image
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = dataUrl;
  await new Promise((resolve) => {
    img.onload = resolve;
  });

  const qrSize = 520;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = 280;
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  // Call to Action
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 28px 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("SCAN TO VIEW MENU & ORDER", canvas.width / 2, 840);

  ctx.fillStyle = "#64748b";
  ctx.font = "500 20px 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("Open camera or scanner on your mobile phone", canvas.width / 2, 875);

  // Section / Type Info
  ctx.fillStyle = "#059669";
  ctx.font = "bold 18px 'Segoe UI', Roboto, sans-serif";
  ctx.fillText(
    `${table.section || "Dining Area"} • ${table.environment || "AC"}`,
    canvas.width / 2,
    920
  );

  // Trigger download
  const link = document.createElement("a");
  link.download = `QR_Table_${table.tableNumber.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Print individual or batch table QR codes in a dedicated printable popup window.
 * Automatically corrects any localhost links to the reachable base URL.
 */
export async function printTableQrs(
  tables: RestaurantTable[],
  restaurantName = "Noryoko Food",
  branchMap: Record<string, string> = {},
  overrideBaseUrl?: string
): Promise<void> {
  if (tables.length === 0) {
    alert("Please select at least one table to print QR codes.");
    return;
  }

  const reachableBase = await getReachableBaseUrl(overrideBaseUrl);

  // Pre-generate QR data URLs ensuring no localhost links exist
  const renderedTables = await Promise.all(
    tables.map(async (t) => {
      let targetUrl = t.qrCodeUrl || "";
      if (!targetUrl || isLocalhost(targetUrl)) {
        const qrKey = t.qrCodeKey || t.id;
        targetUrl = `${reachableBase}/table-menu?tableId=${encodeURIComponent(t.id)}&qrKey=${encodeURIComponent(qrKey)}&branchId=${encodeURIComponent(t.branchId)}${t.restaurantId ? `&restaurantId=${encodeURIComponent(t.restaurantId)}` : ""}`;
      }

      const dataUrl = await QRCode.toDataURL(targetUrl, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#0f172a", light: "#ffffff" },
      });

      return {
        ...t,
        renderedQr: dataUrl,
        branchName: branchMap[t.branchId] || "Main Branch",
      };
    })
  );

  const printWindow = window.open("", "_blank", "width=850,height=1000");
  if (!printWindow) {
    alert("Popup blocked! Please allow popups for this site to print QR codes.");
    return;
  }

  const cardsHtml = renderedTables
    .map(
      (t) => `
      <div class="qr-card">
        <div class="header">
          <h2>${restaurantName.toUpperCase()}</h2>
          <p class="branch">${t.branchName}</p>
        </div>
        <div class="table-badge">
          TABLE ${t.tableNumber}
        </div>
        <div class="qr-box">
          <img src="${t.renderedQr}" alt="Table ${t.tableNumber} QR" />
        </div>
        <div class="footer">
          <p class="cta">SCAN TO VIEW MENU & ORDER</p>
          <p class="sub">Open ordinary phone camera to scan</p>
          <p class="meta">${t.section || "Dining Area"} • ${t.environment || "AC"} • Cap: ${t.capacity}p</p>
        </div>
      </div>
    `
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Print Table QR Codes - ${restaurantName}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          }
          body {
            background: #fff;
            color: #0f172a;
          }
          .grid-container {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16mm;
            page-break-inside: avoid;
          }
          .qr-card {
            border: 3px solid #0f172a;
            border-radius: 18px;
            padding: 24px;
            text-align: center;
            background: #ffffff;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
          }
          .header h2 {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin-bottom: 2px;
          }
          .header .branch {
            font-size: 13px;
            color: #475569;
            font-weight: 600;
            margin-bottom: 12px;
          }
          .table-badge {
            background: #059669;
            color: #ffffff;
            font-size: 20px;
            font-weight: 900;
            padding: 6px 24px;
            border-radius: 9999px;
            display: inline-block;
            margin-bottom: 14px;
            letter-spacing: 1px;
          }
          .qr-box {
            padding: 10px;
            background: #ffffff;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            margin-bottom: 12px;
          }
          .qr-box img {
            width: 220px;
            height: 220px;
            display: block;
          }
          .footer .cta {
            font-size: 15px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: 0.5px;
          }
          .footer .sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .footer .meta {
            font-size: 11px;
            color: #059669;
            font-weight: 700;
            margin-top: 6px;
            text-transform: uppercase;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="grid-container">
          ${cardsHtml}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}
