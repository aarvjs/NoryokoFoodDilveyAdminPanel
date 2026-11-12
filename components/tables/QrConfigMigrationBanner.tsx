"use client";

import React, { useState, useEffect } from "react";
import { 
  QrCode, Wifi, Globe, RefreshCw, CheckCircle2, AlertTriangle, 
  Settings2, ExternalLink, HelpCircle, ChevronDown, ChevronUp, Edit3 
} from "lucide-react";
import { RestaurantTable } from "@/types";
import { isLocalhost, getReachableBaseUrl } from "@/lib/utils/qrUtils";
import { tableService } from "@/services/tableService";
import { useStore } from "@/lib/store/useStore";

interface QrConfigMigrationBannerProps {
  tables: RestaurantTable[];
  onMigrated?: () => void;
}

export function QrConfigMigrationBanner({ tables, onMigrated }: QrConfigMigrationBannerProps) {
  const setTables = useStore((state) => state.setTables);
  const [lanUrl, setLanUrl] = useState<string>("");
  const [productionUrl, setProductionUrl] = useState<string>("https://food-delivery-app-b7e0b.web.app");
  const [currentBaseUrl, setCurrentBaseUrl] = useState<string>("");
  const [customInput, setCustomInput] = useState<string>("");
  const [isEditingCustom, setIsEditingCustom] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [migrating, setMigrating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Identify tables with localhost or missing QR links
  const localhostTables = tables.filter((t) => isLocalhost(t.qrCodeUrl || ""));
  const hasLocalhostIssues = localhostTables.length > 0;

  useEffect(() => {
    async function loadNetworkInfo() {
      let resolvedLan = "";
      let resolvedProd = "https://food-delivery-app-b7e0b.web.app";
      try {
        const res = await fetch("/api/network-ip");
        if (res.ok) {
          const data = await res.json();
          if (data.lanUrl) {
            resolvedLan = data.lanUrl;
            setLanUrl(data.lanUrl);
          }
          if (data.productionUrl) {
            resolvedProd = data.productionUrl;
            setProductionUrl(data.productionUrl);
          }
        }
      } catch (err) {
        console.warn("Could not query /api/network-ip:", err);
      }

      const active = await getReachableBaseUrl();
      setCurrentBaseUrl(active);
      setCustomInput(active);
    }
    loadNetworkInfo();
  }, []);

  const handleApplyBaseUrl = async (newUrl: string) => {
    const cleanUrl = newUrl.trim().replace(/\/$/, "");
    if (!cleanUrl) return;
    try {
      localStorage.setItem("noryoko_qr_base_url", cleanUrl);
    } catch (_) {}
    setCurrentBaseUrl(cleanUrl);
    setCustomInput(cleanUrl);
    setIsEditingCustom(false);
    setStatusMessage({
      type: "success",
      text: `Base URL updated to: ${cleanUrl}. Click "Fix / Update QRs" to migrate tables.`,
    });
  };

  const handleMigrateAll = async (onlyLocalhost: boolean) => {
    const targetTables = onlyLocalhost ? localhostTables : tables;
    if (targetTables.length === 0) {
      setStatusMessage({ type: "success", text: "No tables need QR updates." });
      return;
    }

    setMigrating(true);
    setStatusMessage(null);
    try {
      const activeBase = currentBaseUrl || (await getReachableBaseUrl());
      const result = await tableService.migrateTableQrs(targetTables, activeBase);

      // Refresh tables in store
      try {
        const refreshed = await tableService.getTables();
        if (refreshed && refreshed.length > 0) {
          setTables(refreshed);
        }
      } catch (_) {}

      if (result.errors.length > 0) {
        setStatusMessage({
          type: "error",
          text: `Updated ${result.updatedCount} tables, with ${result.errors.length} error(s).`,
        });
      } else {
        setStatusMessage({
          type: "success",
          text: `Successfully updated ${result.updatedCount} table QR code(s) to ${activeBase}!`,
        });
      }

      if (onMigrated) onMigrated();
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: `Migration failed: ${err.message || err}`,
      });
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs">
      {/* Primary Status Header */}
      <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">QR Scanning & Base URL Engine</span>
              {hasLocalhostIssues ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-300" /> {localhostTables.length} Localhost QRs Found
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-300" /> All Reachable
                </span>
              )}
            </div>
            <p className="text-slate-300 text-[11px] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>Active Target:</span>
              <code className="bg-slate-950/70 text-emerald-400 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-700/60 max-w-xs truncate inline-block">
                {currentBaseUrl || "Resolving reachable URL..."}
              </code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {hasLocalhostIssues && (
            <button
              onClick={() => handleMigrateAll(true)}
              disabled={migrating}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-slate-950 font-bold rounded-lg shadow-sm flex items-center gap-1.5 text-xs transition-all"
              title="Replace localhost links in existing QR codes with customer-reachable URL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${migrating ? "animate-spin" : ""}`} />
              {migrating ? "Updating..." : `Fix ${localhostTables.length} Localhost QRs`}
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 flex items-center gap-1 text-xs"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Configure</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Configuration & Network Selector */}
      {isExpanded && (
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 space-y-4">
          <div>
            <div className="font-bold text-slate-800 text-xs mb-1 flex items-center gap-1.5">
              <span>Select QR Destination Environment:</span>
            </div>
            <p className="text-slate-500 text-[11px] mb-3">
              When customers scan dining table QRs on their phones, they will be routed to this URL.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Option 1: Production Domain */}
              <button
                type="button"
                onClick={() => handleApplyBaseUrl(productionUrl)}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  currentBaseUrl === productionUrl
                    ? "border-emerald-600 bg-emerald-50/70 text-emerald-950 shadow-sm ring-1 ring-emerald-500"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Globe className="w-4 h-4 text-emerald-600" />
                    <span>Production Domain</span>
                  </div>
                  {currentBaseUrl === productionUrl && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">Active</span>
                  )}
                </div>
                <code className="text-[10px] text-slate-600 font-mono block break-all">
                  {productionUrl}
                </code>
                <p className="text-[10px] text-slate-500 mt-1">Recommended for live customer dining.</p>
              </button>

              {/* Option 2: Wi-Fi LAN IP */}
              <button
                type="button"
                onClick={() => lanUrl && handleApplyBaseUrl(lanUrl)}
                disabled={!lanUrl}
                className={`p-3 rounded-xl border text-left transition-all relative ${
                  currentBaseUrl === lanUrl
                    ? "border-purple-600 bg-purple-50/70 text-purple-950 shadow-sm ring-1 ring-purple-500"
                    : "border-slate-200 bg-white hover:border-slate-300 text-slate-800 disabled:opacity-50"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Wifi className="w-4 h-4 text-purple-600" />
                    <span>Wi-Fi / LAN IP</span>
                  </div>
                  {currentBaseUrl === lanUrl && (
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">Active</span>
                  )}
                </div>
                <code className="text-[10px] text-slate-600 font-mono block break-all">
                  {lanUrl || "Auto-detecting Wi-Fi LAN IP..."}
                </code>
                <p className="text-[10px] text-slate-500 mt-1">
                  Recommended for testing from phones connected to the same Wi-Fi.
                </p>
              </button>

              {/* Option 3: Custom Override */}
              <div
                className={`p-3 rounded-xl border text-left transition-all ${
                  isEditingCustom || (currentBaseUrl !== productionUrl && currentBaseUrl !== lanUrl && !!currentBaseUrl)
                    ? "border-blue-600 bg-blue-50/70 shadow-sm ring-1 ring-blue-500"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    <span>Custom URL / Ngrok</span>
                  </div>
                </div>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="https://your-domain.com"
                    className="flex-1 px-2 py-1 text-[11px] font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleApplyBaseUrl(customInput)}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-[11px]"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mass Update Action & Information */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-200">
            <div className="text-[11px] text-slate-600 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <span>
                Tip: When testing on a physical phone, ensure your phone is connected to the same Wi-Fi network and select <b>Wi-Fi / LAN IP</b>.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleMigrateAll(false)}
                disabled={migrating}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${migrating ? "animate-spin" : ""}`} />
                {migrating ? "Regenerating..." : `Regenerate All Tables (${tables.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-t border-emerald-200"
              : "bg-red-50 text-red-800 border-t border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

