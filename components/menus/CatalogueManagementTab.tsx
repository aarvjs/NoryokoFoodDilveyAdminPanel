"use client";

import React, { useState } from "react";
import { 
  QrCode, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  ExternalLink, 
  UtensilsCrossed, 
  Sparkles,
  Check,
  Loader2
} from "lucide-react";
import { Product, Branch, RestaurantTable } from "@/types";
import { menuService } from "@/services/menuService";

interface CatalogueManagementTabProps {
  products: Product[];
  branches: Branch[];
  tables?: RestaurantTable[];
  selectedBranchId: string;
  onSelectBranch: (id: string) => void;
  onRefresh?: () => void;
}

export const CatalogueManagementTab: React.FC<CatalogueManagementTabProps> = ({
  products,
  branches,
  tables = [],
  selectedBranchId,
  onSelectBranch,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const activeBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const branchTables = tables.filter((t) => !activeBranch || t.branchId === activeBranch.id);
  const sampleTable = branchTables[0];

  // Filter products for this branch
  const branchProducts = products.filter((p) => {
    if (activeBranch && p.branchId && p.branchId !== activeBranch.id && (!p.branchIds || !p.branchIds.includes(activeBranch.id))) {
      return false;
    }
    return true;
  });

  const categories = ["ALL", ...Array.from(new Set(branchProducts.map((p) => p.category).filter(Boolean)))];

  const filteredProducts = branchProducts.filter((p) => {
    if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q);
    }
    return true;
  });

  const catalogueCount = branchProducts.filter((p) => p.inCatalogue !== false && p.status !== "INACTIVE").length;

  const handleToggleCatalogue = async (product: Product) => {
    setUpdatingId(product.id);
    const nextVal = product.inCatalogue === false ? true : false;
    try {
      await menuService.updateMenuItem(product.id, {
        inCatalogue: nextVal,
      } as any);
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert("Failed to update catalogue status: " + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkToggle = async (enableAll: boolean) => {
    if (!confirm(`Are you sure you want to ${enableAll ? "include all" : "remove all"} active items in the QR Digital Catalogue for ${activeBranch?.name || "this branch"}?`)) {
      return;
    }
    setUpdatingId("BULK");
    try {
      for (const p of branchProducts) {
        if ((enableAll && p.inCatalogue === false) || (!enableAll && p.inCatalogue !== false)) {
          await menuService.updateMenuItem(p.id, { inCatalogue: enableAll } as any);
        }
      }
      if (onRefresh) onRefresh();
    } catch (e: any) {
      alert("Bulk update error: " + e.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const previewUrl = sampleTable
    ? `/table-menu?tableId=${sampleTable.id}&qrKey=${sampleTable.qrCodeKey || sampleTable.id}&branchId=${activeBranch?.id || ""}`
    : `/table-menu`;

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-semibold rounded-full border border-emerald-500/30 mb-2">
            <QrCode className="w-3.5 h-3.5" /> Mobile Table Catalogue
          </span>
          <h2 className="text-2xl font-black tracking-tight">QR Digital Food Catalogue Management</h2>
          <p className="text-xs text-emerald-100 max-w-xl mt-1">
            Choose which menu items are orderable when guests scan table QR codes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-xl shadow-lg flex items-center gap-1.5 transition-all"
          >
            <Eye className="w-4 h-4 text-emerald-600" /> Preview Live QR Menu <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        {/* Branch Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-700">Branch:</span>
          <select
            value={selectedBranchId}
            onChange={(e) => onSelectBranch(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-900"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold">
            {catalogueCount} Items in QR Menu
          </span>
        </div>

        {/* Bulk Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleBulkToggle(true)}
            disabled={updatingId === "BULK"}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl flex items-center gap-1 transition-colors"
          >
            <Check className="w-3.5 h-3.5" /> Include All Items
          </button>
          <button
            onClick={() => handleBulkToggle(false)}
            disabled={updatingId === "BULK"}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold rounded-xl flex items-center gap-1 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" /> Exclude All
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search food in catalogue..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto custom-scrollbar pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full whitespace-nowrap font-bold text-[11px] transition-colors ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalogue Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
        {filteredProducts.map((p) => {
          const inCatalogue = p.inCatalogue !== false;
          const isVeg = p.foodType === "Veg" || p.isVeg;
          const isUpdating = updatingId === p.id;

          return (
            <div
              key={p.id}
              className={`bg-white border rounded-2xl p-4 space-y-3 shadow-sm hover:shadow-md transition-all ${
                inCatalogue ? "border-emerald-200 bg-white" : "border-slate-200 opacity-60 bg-slate-50"
              }`}
            >
              <div className="flex gap-3">
                <img
                  src={p.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100&auto=format&fit=crop&q=80"}
                  alt={p.name}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0 bg-slate-100"
                />
                <div className="space-y-0.5 overflow-hidden">
                  <div className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <p className="font-bold text-slate-900 text-xs truncate">{p.name}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">{p.category || "Main"}</p>
                  <p className="font-black text-emerald-700 text-xs">₹{p.price}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${inCatalogue ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className="font-bold text-[11px] text-slate-700">
                    {inCatalogue ? "In QR Menu" : "Excluded"}
                  </span>
                </div>

                <button
                  onClick={() => handleToggleCatalogue(p)}
                  disabled={isUpdating}
                  className={`px-3 py-1 rounded-full text-[11px] font-black transition-all ${
                    inCatalogue
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                  }`}
                >
                  {isUpdating ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : inCatalogue ? (
                    "ON"
                  ) : (
                    "OFF"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

