"use client";

import React, { useState } from "react";
import { Grid3X3, Plus, Edit3, Trash2, X, Loader2, QrCode, CheckCircle2, Download, Printer, Power } from "lucide-react";
import { TableModel } from "@/models/table";
import { BranchModel } from "@/models/branch";
import { tableRepository } from "@/repositories/tableRepository";
import { branchRepository } from "@/repositories/branchRepository";
import { tableService } from "@/services/tableService";
import { downloadTableQr, printTableQrs } from "@/lib/utils/qrUtils";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface TablesModuleProps {
  restaurantId: string;
  branches: BranchModel[];
  tables: TableModel[];
  onRefresh: () => void;
}

export function TablesModule({ restaurantId, branches, tables, onRefresh }: TablesModuleProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableModel | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [deletingTableId, setDeletingTableId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branches[0]?.id || "");
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);

  const handleToggleActive = async (table: TableModel) => {
    const nextState = table.isActive === false ? true : false;
    if (!nextState) {
      setToggleLoadingId(table.id);
      try {
        const { hasActiveBooking, hasActiveOrder, activeBookingsCount, activeOrdersCount } = 
          await tableService.checkActiveTableSessions(table.id);
        if (hasActiveBooking || hasActiveOrder) {
          const proceed = window.confirm(
            `⚠️ Warning: Table ${table.tableNumber} currently has:\n` +
            (hasActiveBooking ? `• ${activeBookingsCount} active reservation(s)\n` : "") +
            (hasActiveOrder ? `• ${activeOrdersCount} ongoing order(s)\n` : "") +
            `\nDeactivating this table will hide it from new customer bookings and QR scanning, but existing orders/bookings will NOT be cancelled or deleted.\n\nDo you want to proceed with deactivation?`
          );
          if (!proceed) {
            setToggleLoadingId(null);
            return;
          }
        }
      } catch (e) {
        console.warn("Active sessions check notice:", e);
      }
    }

    try {
      setToggleLoadingId(table.id);
      await tableRepository.updateTable(table.id, { isActive: nextState });
      setToastMessage(`Table ${table.tableNumber} is now ${nextState ? "ACTIVE" : "INACTIVE"}`);
      onRefresh();
    } catch (err: any) {
      alert("Failed to toggle table status: " + err.message);
    } finally {
      setToggleLoadingId(null);
    }
  };

  const [formData, setFormData] = useState({
    branchId: branches[0]?.id || "",
    tableNumber: "T-101",
    section: "Main Dining Floor",
    capacity: 4,
    type: "Indoor" as "Indoor" | "Outdoor" | "Rooftop" | "VIP Room",
    environment: "AC" as "AC" | "Non AC" | "Open Air",
    status: "AVAILABLE" as any
  });

  const activeHeaderBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
  const activeModalBranch = branches.find((b) => b.id === (formData.branchId || branches[0]?.id)) || branches[0];

  const handleOpenModal = (table?: TableModel) => {
    if (table) {
      setEditingTable(table);
      setFormData({
        branchId: table.branchId || branches[0]?.id || "",
        tableNumber: table.tableNumber || "T-101",
        section: table.section || "Main Dining Floor",
        capacity: table.capacity || 4,
        type: (table.type as any) || "Indoor",
        environment: (table.environment as any) || "AC",
        status: table.status || "AVAILABLE"
      });
    } else {
      setEditingTable(null);
      setFormData({
        branchId: selectedBranchId || branches[0]?.id || "",
        tableNumber: `T-${Math.floor(100 + Math.random() * 900)}`,
        section: "Main Dining Floor",
        capacity: 4,
        type: "Indoor",
        environment: "AC",
        status: "AVAILABLE"
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        restaurantId,
        branchId: formData.branchId || branches[0]?.id || "",
        tableNumber: formData.tableNumber,
        section: formData.section,
        capacity: Number(formData.capacity),
        type: formData.type,
        environment: formData.environment,
        status: formData.status
      };

      if (editingTable) {
        await tableRepository.updateTable(editingTable.id, payload);
        setToastMessage("Table configuration updated!");
      } else {
        await tableRepository.createTable(payload);
        setToastMessage("New dining table added!");
      }

      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      alert("Failed to save table: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTableId) return;
    setSubmitting(true);
    try {
      await tableRepository.deleteTable(deletingTableId);
      setToastMessage("Table deleted.");
      setDeletingTableId(null);
      onRefresh();
    } catch (err: any) {
      alert("Failed to delete table: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toastMessage && (
        <Toast message={toastMessage} type="success" onClose={() => setToastMessage(null)} />
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-emerald-600" /> Floor Tables & QR Codes
          </h2>
          <p className="text-xs text-slate-500">Configure dining tables, seating capacity & reservation status</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {branches.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 p-1.5 rounded-xl text-xs">
              <span className="font-bold text-slate-700">Branch:</span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-bold text-slate-900 text-xs"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({(b.tableBookingEnabled ?? true) ? "Service ON" : "Service OFF"})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={async () => {
                  if (!activeHeaderBranch) return;
                  const nextVal = !(activeHeaderBranch.tableBookingEnabled ?? true);
                  await branchRepository.update(activeHeaderBranch.id, { tableBookingEnabled: nextVal });
                  setToastMessage(`Table Service ${nextVal ? 'Enabled' : 'Disabled'} for ${activeHeaderBranch.name}`);
                  onRefresh();
                }}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  (activeHeaderBranch?.tableBookingEnabled ?? true)
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-rose-600 text-white shadow-sm"
                }`}
              >
                Table Service: {(activeHeaderBranch?.tableBookingEnabled ?? true) ? "ON" : "OFF"}
              </button>
            </div>
          )}

          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Table
          </button>
        </div>
      </div>

      {/* Table Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
        {tables.map((t) => {
          const branch = branches.find((b) => b.id === t.branchId);
          return (
            <div key={t.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between font-black text-slate-900 text-sm">
                <span className="flex items-center gap-1.5"><QrCode className="w-4 h-4 text-emerald-600" /> {t.tableNumber}</span>
                <div className="flex items-center gap-1.5">
                  {/* Table Active/Inactive toggle */}
                  <button
                    type="button"
                    disabled={toggleLoadingId === t.id}
                    onClick={() => handleToggleActive(t)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                      t.isActive !== false
                        ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                    }`}
                    title={t.isActive !== false ? "Active table. Click to deactivate." : "Inactive table. Click to activate."}
                  >
                    <Power className="w-2.5 h-2.5" />
                    {toggleLoadingId === t.id ? "..." : (t.isActive !== false ? "ON" : "OFF")}
                  </button>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] uppercase font-bold">{t.status}</span>
                </div>
              </div>

              <div className="text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                <p>Section: <strong>{t.section}</strong></p>
                <p>Capacity: <strong>{t.capacity} Persons</strong> ({t.type})</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => downloadTableQr(t as any, "Noryoko Food", branch?.name || "Main Branch")}
                    className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                    title="Download Table QR"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600" /> QR
                  </button>
                  <button
                    type="button"
                    onClick={() => printTableQrs([t as any], "Noryoko Food", { [t.branchId]: branch?.name || "Main Branch" })}
                    className="p-1.5 text-slate-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg flex items-center gap-1 text-[11px] font-bold"
                    title="Print Table QR"
                  >
                    <Printer className="w-3.5 h-3.5 text-purple-600" />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleOpenModal(t)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeletingTableId(t.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for Add Table */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingTable ? "Edit Table" : "Add Dining Table"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              {!editingTable && branches.length > 0 && (
                <div className="space-y-2">
                  <label className="block font-bold text-slate-700 mb-1">Target Branch *</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                    className="w-full p-2.5 bg-white text-slate-900 border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="" className="text-slate-900 bg-white">Select Target Branch...</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id} className="text-slate-900 bg-white font-bold">
                        {b.name || "Branch"} ({(b.tableBookingEnabled ?? true) ? "Table Service ON" : "Table Service OFF"})
                      </option>
                    ))}
                  </select>

                  {/* Branch Table Service Toggle inside modal dropdown area */}
                  {activeModalBranch && (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800 text-[11px]">Table Service for {activeModalBranch.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const nextVal = !(activeModalBranch.tableBookingEnabled ?? true);
                          await branchRepository.update(activeModalBranch.id, { tableBookingEnabled: nextVal });
                          setToastMessage(`Table Service ${nextVal ? 'Enabled' : 'Disabled'} for ${activeModalBranch.name}`);
                          onRefresh();
                        }}
                        className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                          (activeModalBranch.tableBookingEnabled ?? true)
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "bg-rose-600 text-white shadow-sm"
                        }`}
                      >
                        {(activeModalBranch.tableBookingEnabled ?? true) ? "ON" : "OFF"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Table Number / Code *</label>
                <input
                  type="text"
                  required
                  value={formData.tableNumber}
                  onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  placeholder="e.g. T-101"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Floor Section</label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="Main Dining / AC Hall"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Capacity (Guests)</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                    <option value="Rooftop">Rooftop</option>
                    <option value="VIP Room">VIP Room</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">Cancel</button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Table
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deletingTableId}
        onClose={() => setDeletingTableId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Dining Table"
        message="Are you sure you want to delete this table?"
        loading={submitting}
      />
    </div>
  );
}
