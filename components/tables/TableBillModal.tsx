"use client";

import React, { useState, useEffect } from "react";
import { X, Printer, CheckCircle2, Clock, DollarSign, Utensils, AlertCircle, Loader2 } from "lucide-react";
import { RestaurantTable, Order, TableBooking } from "@/types";
import { tableService } from "@/services/tableService";
import { orderService } from "@/services/orderService";

interface TableBillModalProps {
  table: RestaurantTable;
  branchName?: string;
  restaurantName?: string;
  booking?: TableBooking | null;
  onClose: () => void;
  onTableReleased?: () => void;
}

export const TableBillModal: React.FC<TableBillModalProps> = ({
  table,
  branchName = "Main Branch",
  restaurantName = "Noryoko Food",
  booking,
  onClose,
  onTableReleased,
}) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [table.id]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const ords = await tableService.getTableOrders(table.id);
      setOrders(ords);
    } catch (e) {
      console.warn("Failed to load table orders:", e);
    } finally {
      setLoading(false);
    }
  };

  // Consolidate all items across all orders for this table
  const allItems = orders.flatMap((ord) =>
    (ord.items || []).map((it) => ({
      ...it,
      orderSource: ord.orderSource || "QR",
      orderNumber: ord.orderNumber || ord.id.substring(0, 8),
      orderStatus: ord.status,
    }))
  );

  const subtotal = orders.reduce((sum, ord) => sum + Number(ord.subtotal || 0), 0);
  const tax = orders.reduce((sum, ord) => sum + Number(ord.tax || 0), 0);
  const totalAmount = orders.reduce((sum, ord) => sum + Number(ord.totalAmount || 0), 0);

  const isAllPaid =
    orders.length > 0 &&
    orders.every(
      (o) =>
        (o.paymentStatus || "").toUpperCase() === "PAID" ||
        (o.paymentStatus || "").toUpperCase() === "SUCCESS"
    );

  const handleSettlePayment = async () => {
    if (orders.length === 0) return;
    setSettling(true);
    try {
      // Mark all orders for this table session as PAID
      for (const ord of orders) {
        if ((ord.paymentStatus || "").toUpperCase() !== "PAID") {
          await orderService.updateOrder(ord.id, {
            paymentStatus: "PAID",
            paidAt: new Date().toISOString(),
          } as any);
        }
      }
      await loadOrders();
    } catch (e: any) {
      alert("Error settling payment: " + e.message);
    } finally {
      setSettling(false);
    }
  };

  const handleReleaseTable = async () => {
    if (!confirm(`Are you sure you want to complete this dining session and release Table ${table.tableNumber}?`)) {
      return;
    }
    setSettling(true);
    try {
      await tableService.releaseTableSession(table.id, booking?.id);
      if (onTableReleased) onTableReleased();
      onClose();
    } catch (e: any) {
      alert("Error releasing table: " + e.message);
    } finally {
      setSettling(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=650,height=900");
    if (!printWindow) {
      alert("Popup blocked! Please allow popups to print.");
      return;
    }

    const itemsRows = allItems
      .map(
        (it) => `
        <tr>
          <td style="padding: 6px 0;">
            <div style="font-weight: bold;">${it.productName}</div>
            <div style="font-size: 10px; color: #64748b;">${it.orderSource === "COUNTER" ? "[Counter]" : "[QR App]"} ${it.customizations?.join(", ") || ""}</div>
          </td>
          <td style="text-align: center; padding: 6px 0;">${it.quantity}</td>
          <td style="text-align: right; padding: 6px 0;">Rs. ${(it.price || 0).toFixed(2)}</td>
          <td style="text-align: right; padding: 6px 0; font-weight: bold;">Rs. ${((it.price || 0) * (it.quantity || 1)).toFixed(2)}</td>
        </tr>
      `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Table Bill - ${table.tableNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }
            body { background: #fff; color: #000; padding: 8px; font-size: 12px; }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 3px 0; }
            .bold { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            th { text-align: left; font-size: 10px; border-bottom: 1px solid #000; padding-bottom: 4px; }
            .total-banner { font-size: 16px; font-weight: 900; margin-top: 6px; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="font-size: 18px;">${restaurantName.toUpperCase()}</h2>
            <p>${branchName}</p>
            <p style="font-weight: bold; margin-top: 4px; font-size: 14px;">TABLE BILL: ${table.tableNumber}</p>
            <p style="font-size: 10px; color: #555;">Date: ${new Date().toLocaleString()}</p>
          </div>
          <div class="divider"></div>
          ${booking ? `<div class="row"><span>Booking ID:</span><span class="bold">${booking.id.substring(0, 8)}</span></div>` : ""}
          <div class="row"><span>Section:</span><span>${table.section || "Dining"}</span></div>
          <div class="row"><span>Orders Count:</span><span class="bold">${orders.length} order(s)</span></div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>ITEM</th>
                <th style="text-align: center;">QTY</th>
                <th style="text-align: right;">PRICE</th>
                <th style="text-align: right;">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="row"><span>Subtotal:</span><span>Rs. ${subtotal.toFixed(2)}</span></div>
          <div class="row"><span>Taxes & GST:</span><span>Rs. ${tax.toFixed(2)}</span></div>
          <div class="divider"></div>
          <div class="row total-banner">
            <span>FINAL TOTAL:</span>
            <span>Rs. ${totalAmount.toFixed(2)}</span>
          </div>
          <div class="row" style="margin-top: 4px;">
            <span>Payment Status:</span>
            <span class="bold">${isAllPaid ? "PAID" : "PENDING"}</span>
          </div>
          <div class="divider"></div>
          <div class="center" style="font-size: 10px; margin-top: 8px;">
            <p>Thank you for visiting ${restaurantName}!</p>
            <p>Please visit again.</p>
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-6 relative flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Utensils className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              Consolidated Table Bill
            </span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <div>
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                Table {table.tableNumber}
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                  isAllPaid ? "bg-emerald-500 text-white" : "bg-amber-500 text-slate-950"
                }`}>
                  {isAllPaid ? "PAID" : "UNPAID"}
                </span>
              </h2>
              <p className="text-xs text-slate-400">{restaurantName} • {branchName}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase">Total Payable</p>
              <p className="text-2xl font-black text-emerald-400">₹{totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Bill Content */}
        <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar flex-1 text-xs text-slate-700">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              <p>Loading table orders & items...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Utensils className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No Food Orders Placed Yet</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                No orders have been received from the QR menu or counter staff for this table yet.
              </p>
            </div>
          ) : (
            <>
              {/* Order Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-slate-500 font-bold text-[11px] uppercase pb-1 border-b border-slate-200">
                  <span>Ordered Items ({allItems.length})</span>
                  <span>{orders.length} Order Ticket(s)</span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                  {allItems.map((item, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between bg-white hover:bg-slate-50">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.productName}</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            item.orderSource === "COUNTER"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}>
                            {item.orderSource === "COUNTER" ? "Counter" : "QR"}
                          </span>
                        </div>
                        {item.customizations && item.customizations.length > 0 && (
                          <p className="text-[11px] text-slate-500">{item.customizations.join(", ")}</p>
                        )}
                        <p className="text-[10px] text-slate-400 font-mono">Ticket #{item.orderNumber}</p>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-slate-900">
                          {item.quantity} × ₹{item.price} = ₹{(item.quantity * item.price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial Calculation */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Taxes & GST</span>
                  <span className="font-bold text-slate-900">₹{tax.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-sm font-black text-slate-900">
                  <span>Grand Total</span>
                  <span className="text-emerald-700 text-base">₹{totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
          <button
            onClick={handleReleaseTable}
            disabled={settling}
            className="px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
          >
            Release Table 🪑
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={orders.length === 0}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" /> Print Bill
            </button>

            {!isAllPaid && orders.length > 0 && (
              <button
                onClick={handleSettlePayment}
                disabled={settling}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {settling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Settle Payment
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

