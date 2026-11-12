"use client";

import React, { useState } from "react";
import { 
  Grid3X3, Plus, GitFork, X, Trash2, Calendar, Clock, UserCheck, CheckCircle2, 
  Loader2, QrCode, Download, Printer, Receipt, Utensils, Power, CheckSquare, Square, AlertTriangle 
} from "lucide-react";
import { useStore } from "@/lib/store/useStore";
import { RestaurantTable, TableBooking } from "@/types";
import { downloadTableQr, printTableQrs } from "@/lib/utils/qrUtils";
import { tableService } from "@/services/tableService";
import { BookingReceiptModal } from "@/components/tables/BookingReceiptModal";
import { TableBillModal } from "@/components/tables/TableBillModal";
import { CounterTableOrderModal } from "@/components/tables/CounterTableOrderModal";
import { QrConfigMigrationBanner } from "@/components/tables/QrConfigMigrationBanner";

export default function SuperAdminTablesPage() {
  const tables = useStore((state) => state.tables);
  const tableBookings = useStore((state) => state.tableBookings);
  const branches = useStore((state) => state.branches);
  const restaurants = useStore((state) => state.restaurants);
  const products = useStore((state) => state.products);
  const addTable = useStore((state) => state.addTable);
  const deleteTable = useStore((state) => state.deleteTable);
  const toggleTableActive = useStore((state) => state.toggleTableActive);
  const createTableBooking = useStore((state) => state.createTableBooking);
  const updateBookingStatus = useStore((state) => state.updateBookingStatus);

  const [activeTab, setActiveTab] = useState<"TABLES" | "BOOKINGS">("TABLES");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // QR, Billing & Counter Order State
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);
  const [receiptBooking, setReceiptBooking] = useState<TableBooking | null>(null);
  const [billingTable, setBillingTable] = useState<RestaurantTable | null>(null);
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [preselectedBooking, setPreselectedBooking] = useState<TableBooking | null>(null);
  const [preselectedTable, setPreselectedTable] = useState<RestaurantTable | null>(null);
  const [toggleLoadingTableId, setToggleLoadingTableId] = useState<string | null>(null);

  const restaurantName = restaurants[0]?.name || "Noryoko Food";
  const branchMap: Record<string, string> = {};
  branches.forEach((b) => {
    branchMap[b.id] = b.name;
  });

  const [formData, setFormData] = useState({
    branchId: branches[0]?.id || "",
    tableNumber: "",
    capacity: 4,
    section: "Main Hall",
    type: "Indoor" as "Indoor" | "Outdoor",
    environment: "AC" as "AC" | "Non AC",
    status: "AVAILABLE" as "AVAILABLE" | "BOOKED" | "RESERVED" | "MAINTENANCE"
  });

  const [bookingForm, setBookingForm] = useState({
    branchId: branches[0]?.id || "",
    tableId: "",
    customerName: "",
    customerPhone: "",
    date: new Date().toISOString().split("T")[0],
    time: "07:30 PM",
    guests: 2
  });

  const handleSaveTable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addTable({
        branchId: formData.branchId || branches[0]?.id || "",
        tableNumber: formData.tableNumber,
        capacity: Number(formData.capacity),
        section: formData.section,
        type: formData.type,
        environment: formData.environment,
        status: formData.status
      });
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Failed to save table: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const selectedTable = tables.find(t => t.id === bookingForm.tableId);
      await createTableBooking({
        branchId: bookingForm.branchId || selectedTable?.branchId || branches[0]?.id || "",
        tableId: bookingForm.tableId,
        tableNumber: selectedTable?.tableNumber || "T-101",
        customerName: bookingForm.customerName,
        customerPhone: bookingForm.customerPhone,
        date: bookingForm.date,
        time: bookingForm.time,
        guests: Number(bookingForm.guests),
        status: "CONFIRMED"
      });
      setIsBookingModalOpen(false);
    } catch (err: any) {
      alert("Failed to create booking: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (table: RestaurantTable) => {
    const nextState = table.isActive === false ? true : false;
    if (!nextState) {
      setToggleLoadingTableId(table.id);
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
            setToggleLoadingTableId(null);
            return;
          }
        }
      } catch (e) {
        console.warn("Could not check active sessions:", e);
      }
    }

    try {
      setToggleLoadingTableId(table.id);
      await toggleTableActive(table.id, nextState);
    } catch (err: any) {
      alert("Failed to toggle table status: " + err.message);
    } finally {
      setToggleLoadingTableId(null);
    }
  };

  const handlePrintSelectedQrs = async () => {
    const selectedTables = tables.filter((t) => selectedTableIds.includes(t.id));
    if (selectedTables.length === 0) {
      alert("Please select one or more tables first using the checkboxes.");
      return;
    }
    await printTableQrs(selectedTables, restaurantName, branchMap);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Grid3X3 className="w-6 h-6 text-emerald-600" /> Dining Tables & Customer Reservations
          </h1>
          <p className="text-xs text-slate-500">Super Admin layout management & customer table bookings across branches</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveTab("TABLES")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${activeTab === "TABLES" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              Tables ({tables.length})
            </button>
            <button
              onClick={() => setActiveTab("BOOKINGS")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${activeTab === "BOOKINGS" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
            >
              Reservations ({tableBookings.length})
            </button>
          </div>

          {/* Counter Table Order Modal Trigger */}
          <button
            onClick={() => {
              setPreselectedBooking(null);
              setIsCounterModalOpen(true);
            }}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            title="Create Counter / Dine-In Order for Table"
          >
            <Utensils className="w-4 h-4 text-amber-400" /> Counter Order
          </button>

          {activeTab === "TABLES" && (
            <>
              {/* Batch Print Selected QRs */}
              <button
                onClick={handlePrintSelectedQrs}
                disabled={selectedTableIds.length === 0}
                className={`px-3.5 py-2 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all ${
                  selectedTableIds.length > 0
                    ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                title="Select tables using checkboxes below to print multiple QR codes at once"
              >
                <Printer className="w-4 h-4" /> Print Selected QRs ({selectedTableIds.length})
              </button>

              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Table
              </button>
            </>
          )}

          {activeTab === "BOOKINGS" && (
            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4" /> New Booking
            </button>
          )}
        </div>
      </div>

      {/* Tables View */}
      {activeTab === "TABLES" && (
        <div className="space-y-4">
          {/* QR Base URL & Network Migration Engine Banner */}
          <QrConfigMigrationBanner tables={tables} />

          {/* Batch Selector Bar */}
          {tables.length > 0 && (
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 px-4 py-2.5 rounded-xl text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedTableIds.length === tables.length && tables.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedTableIds(tables.map((t) => t.id));
                    else setSelectedTableIds([]);
                  }}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                Select All ({tables.length} tables)
              </label>

              {selectedTableIds.length > 0 && (
                <span className="text-purple-700 font-bold">
                  {selectedTableIds.length} table(s) selected for batch actions
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {tables.map((t) => {
              const branch = branches.find((b) => b.id === t.branchId);
              const isSelected = selectedTableIds.includes(t.id);
              return (
                <div 
                  key={t.id} 
                  className={`bg-white border rounded-2xl p-4 space-y-3 shadow-sm hover:shadow-md transition-all ${
                    isSelected ? "border-purple-400 ring-2 ring-purple-100" : "border-slate-200/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedTableIds((prev) => [...prev, t.id]);
                          else setSelectedTableIds((prev) => prev.filter((id) => id !== t.id));
                        }}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        title="Select table for batch QR printing"
                      />
                      <span className="text-lg font-black text-slate-900">{t.tableNumber}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Active / Inactive Toggle Switch */}
                      <button
                        type="button"
                        disabled={toggleLoadingTableId === t.id}
                        onClick={() => handleToggleActive(t)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all cursor-pointer flex items-center gap-1 ${
                          t.isActive !== false
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                        }`}
                        title={
                          t.isActive !== false
                            ? "Active table. Click to turn OFF."
                            : "Inactive table (hidden from customer app). Click to turn ON."
                        }
                      >
                        <Power className="w-2.5 h-2.5" />
                        {toggleLoadingTableId === t.id ? "..." : (t.isActive !== false ? "ON" : "OFF")}
                      </button>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        t.status === "AVAILABLE" ? "bg-emerald-100 text-emerald-800" :
                        t.status === "BOOKED" ? "bg-purple-100 text-purple-800" :
                        t.status === "OCCUPIED" ? "bg-rose-100 text-rose-800" :
                        t.status === "RESERVED" ? "bg-amber-100 text-amber-800" :
                        "bg-slate-100 text-slate-800"
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Branch: <strong className="text-slate-900">{branch?.name || "Main Branch"}</strong></p>
                    <p>Capacity: <strong className="text-slate-900">{t.capacity} Persons</strong></p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{t.type || "Indoor"}</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{t.environment || "AC"}</span>
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">{t.section || "Hall"}</span>
                    </div>
                  </div>

                  {/* Actions Bar: QR, Print, Bill, Delete */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-1 text-xs">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPreselectedBooking(null);
                          setPreselectedTable(t);
                          setIsCounterModalOpen(true);
                        }}
                        className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1 text-[11px] font-bold transition-colors shadow-sm"
                        title="Create Dine-In Counter Order for this Table"
                      >
                        <Utensils className="w-3.5 h-3.5 text-amber-400" /> Order
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadTableQr(t, restaurantName, branch?.name || "Main Branch")}
                        className="px-2 py-1 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-colors border border-slate-200"
                        title="Download Table QR Code Card"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" /> QR
                      </button>
                      <button
                        type="button"
                        onClick={() => printTableQrs([t], restaurantName, branchMap)}
                        className="px-2 py-1 text-slate-700 hover:text-purple-700 hover:bg-purple-50 rounded-lg flex items-center gap-1 text-[11px] font-bold transition-colors border border-slate-200"
                        title="Print Table QR Card"
                      >
                        <Printer className="w-3.5 h-3.5 text-purple-600" /> Print
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setBillingTable(t)}
                        className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg flex items-center gap-1 text-[11px] transition-colors shadow-sm"
                        title="View Table Bill, Settle & Release Table"
                      >
                        <Receipt className="w-3.5 h-3.5" /> Bill
                      </button>
                      <button 
                        type="button"
                        onClick={() => deleteTable(t.id)} 
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        title="Delete Table"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bookings View */}
      {activeTab === "BOOKINGS" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs text-slate-700 whitespace-nowrap min-w-[760px]">
            <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px]">
              <tr>
                <th className="px-4 py-3">Table #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Date & Time</th>
                <th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableBookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-900">{b.tableNumber}</td>
                  <td className="px-4 py-3 font-medium">{b.customerName}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono">{b.customerPhone}</td>
                  <td className="px-4 py-3">{b.date} @ {b.time}</td>
                  <td className="px-4 py-3 font-bold">{b.guests} Guests</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      b.status === "ACCEPTED" || b.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-800" :
                      b.status === "PENDING" ? "bg-amber-100 text-amber-900" :
                      b.status === "COMPLETED" ? "bg-blue-100 text-blue-800" :
                      "bg-rose-100 text-rose-800"
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {/* View Booking Bill / Receipt */}
                    <button
                      type="button"
                      onClick={() => setReceiptBooking(b)}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-bold text-[10px] inline-flex items-center gap-1"
                      title="View & Print Booking Receipt"
                    >
                      <Receipt className="w-3 h-3 text-slate-600" /> Receipt
                    </button>

                    {/* Counter Order Shortcut */}
                    <button
                      type="button"
                      onClick={() => {
                        setPreselectedBooking(b);
                        setIsCounterModalOpen(true);
                      }}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded font-bold text-[10px] inline-flex items-center gap-1"
                      title="Place Counter Order for this Booking"
                    >
                      <Utensils className="w-3 h-3 text-amber-700" /> Order
                    </button>

                    {b.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => updateBookingStatus(b.id, "ACCEPTED", b.tableId)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px]"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => updateBookingStatus(b.id, "REJECTED", b.tableId)}
                          className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded font-bold text-[10px]"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(b.status === "ACCEPTED" || b.status === "CONFIRMED") && (
                      <>
                        <button
                          onClick={() => updateBookingStatus(b.id, "COMPLETED", b.tableId)}
                          className="px-2.5 py-1 bg-blue-600 text-white rounded font-bold text-[10px]"
                        >
                          Complete
                        </button>
                        <button
                          onClick={() => updateBookingStatus(b.id, "NO_SHOW", b.tableId)}
                          className="px-2.5 py-1 bg-amber-50 text-amber-800 rounded font-bold text-[10px]"
                        >
                          No Show
                        </button>
                      </>
                    )}
                    {b.status !== "CANCELLED" && b.status !== "REJECTED" && b.status !== "COMPLETED" && b.status !== "NO_SHOW" && (
                      <button
                        onClick={() => updateBookingStatus(b.id, "CANCELLED", b.tableId)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded font-bold text-[10px]"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Table Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Add Dining Table</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveTable} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Parent Branch</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Table Number *</label>
                <input
                  type="text"
                  required
                  value={formData.tableNumber}
                  onChange={(e) => setFormData({ ...formData, tableNumber: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  placeholder="e.g. Table-05"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Capacity (Persons)</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Section</label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    placeholder="e.g. Main Hall"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Environment</label>
                  <select
                    value={formData.environment}
                    onChange={(e) => setFormData({ ...formData, environment: e.target.value as any })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  >
                    <option value="AC">AC</option>
                    <option value="Non AC">Non AC</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Save Table</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Booking Modal */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Create Table Reservation</h2>
              <button onClick={() => setIsBookingModalOpen(false)} className="p-1 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveBooking} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Table *</label>
                <select
                  required
                  value={bookingForm.tableId}
                  onChange={(e) => setBookingForm({ ...bookingForm, tableId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                >
                  <option value="">Choose Available Table</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>{t.tableNumber} ({t.capacity} Px - {t.type})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={bookingForm.customerName}
                  onChange={(e) => setBookingForm({ ...bookingForm, customerName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="e.g. Ankit Sharma"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Phone *</label>
                <input
                  type="text"
                  required
                  value={bookingForm.customerPhone}
                  onChange={(e) => setBookingForm({ ...bookingForm, customerPhone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  placeholder="+91 9876543210"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={bookingForm.date}
                    onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Time</label>
                  <input
                    type="text"
                    value={bookingForm.time}
                    onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    placeholder="07:30 PM"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className="px-4 py-2 bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow">Confirm Reservation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Booking Receipt Modal */}
      {receiptBooking && (
        <BookingReceiptModal
          booking={receiptBooking}
          restaurantName={restaurantName}
          branchName={branches.find((b) => b.id === receiptBooking.branchId)?.name || "Main Branch"}
          onClose={() => setReceiptBooking(null)}
        />
      )}

      {/* Unified Table Bill Modal */}
      {billingTable && (
        <TableBillModal
          table={billingTable}
          restaurantName={restaurantName}
          branchName={branches.find((b) => b.id === billingTable.branchId)?.name || "Main Branch"}
          booking={tableBookings.find((b) => b.tableId === billingTable.id && (b.status === "ACCEPTED" || b.status === "CONFIRMED")) || null}
          onClose={() => setBillingTable(null)}
          onTableReleased={() => {
            setBillingTable(null);
          }}
        />
      )}

      {/* Counter Table Order Modal */}
      {isCounterModalOpen && (
        <CounterTableOrderModal
          branchId={formData.branchId || branches[0]?.id || ""}
          branchName={branches.find((b) => b.id === (formData.branchId || branches[0]?.id))?.name || "Main Branch"}
          restaurantId={restaurants[0]?.id || ""}
          bookings={tableBookings}
          tables={tables}
          products={products}
          preSelectedBooking={preselectedBooking}
          preSelectedTable={preselectedTable}
          onClose={() => {
            setIsCounterModalOpen(false);
            setPreselectedBooking(null);
            setPreselectedTable(null);
          }}
        />
      )}
    </div>
  );
}
