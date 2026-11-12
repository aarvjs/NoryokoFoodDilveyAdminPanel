"use client";

import React from "react";
import { X, Printer, Calendar, Clock, Users, MapPin, Phone, Mail, CheckCircle2 } from "lucide-react";
import { TableBooking } from "@/types";

interface BookingReceiptModalProps {
  booking: TableBooking;
  branchName?: string;
  restaurantName?: string;
  onClose: () => void;
}

export const BookingReceiptModal: React.FC<BookingReceiptModalProps> = ({
  booking,
  branchName = "Main Branch",
  restaurantName = "Noryoko Food",
  onClose,
}) => {
  const printElementId = `booking-receipt-${booking.id}`;

  const handlePrint = () => {
    const el = document.getElementById(printElementId);
    if (!el) {
      window.print();
      return;
    }

    const printWindow = window.open("", "_blank", "width=600,height=800");
    if (!printWindow) {
      alert("Popup blocked! Please allow popups to print receipt.");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Booking Receipt - ${booking.tableNumber}</title>
          <style>
            @page { size: 80mm auto; margin: 5mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: monospace, sans-serif; }
            body { background: #fff; color: #000; padding: 10px; font-size: 12px; }
            .center { text-align: center; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .row { display: flex; justify-content: space-between; margin: 4px 0; }
            .bold { font-weight: bold; }
            .badge { display: inline-block; padding: 3px 8px; border: 1px solid #000; border-radius: 4px; font-weight: bold; margin-top: 4px; }
            .table-num { font-size: 18px; font-weight: 900; margin: 8px 0; text-align: center; border: 2px solid #000; padding: 6px; }
            @media print { body { -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 style="font-size: 16px;">${restaurantName.toUpperCase()}</h2>
            <p>${branchName}</p>
            <p style="font-size: 10px; margin-top: 2px;">TABLE RESERVATION RECEIPT</p>
          </div>
          <div class="divider"></div>
          <div class="table-num">TABLE: ${booking.tableNumber}</div>
          <div class="row"><span>Booking ID:</span><span class="bold">${booking.id.substring(0, 10).toUpperCase()}</span></div>
          <div class="row"><span>Date & Time:</span><span class="bold">${booking.date} @ ${booking.time}</span></div>
          <div class="row"><span>Guests:</span><span class="bold">${booking.guests} Guests</span></div>
          <div class="row"><span>Customer:</span><span class="bold">${booking.customerName}</span></div>
          <div class="row"><span>Phone:</span><span>${booking.customerPhone}</span></div>
          <div class="divider"></div>
          <div class="row"><span>Reservation Fee:</span><span>Rs. 0.00</span></div>
          <div class="row"><span>GST / Taxes:</span><span>Rs. 0.00</span></div>
          <div class="row bold" style="font-size: 13px;"><span>TOTAL AMOUNT:</span><span>Rs. 0.00 (FREE)</span></div>
          <div class="divider"></div>
          <div class="center">
            <span class="badge">${booking.status}</span>
            <p style="font-size: 10px; margin-top: 8px;">Please arrive 10 minutes prior to your booking time.</p>
            <p style="font-size: 9px; margin-top: 4px;">Thank you for dining with us!</p>
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
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-5 h-5 text-emerald-200" />
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">Official Booking Bill</span>
          </div>
          <h2 className="text-xl font-black tracking-tight">{restaurantName}</h2>
          <p className="text-xs text-emerald-100">{branchName}</p>
        </div>

        {/* Receipt Content */}
        <div id={printElementId} className="p-6 space-y-5 text-xs text-slate-700">
          {/* Table Banner */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Assigned Dining Table</p>
            <p className="text-3xl font-black text-emerald-950 mt-0.5">{booking.tableNumber}</p>
            <span className={`inline-block mt-2 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
              booking.status === "CONFIRMED" || booking.status === "ACCEPTED"
                ? "bg-emerald-600 text-white"
                : booking.status === "PENDING"
                ? "bg-amber-100 text-amber-900 border border-amber-300"
                : "bg-slate-200 text-slate-800"
            }`}>
              {booking.status}
            </span>
          </div>

          {/* Details Table */}
          <div className="space-y-2.5 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Booking ID</span>
              <span className="font-mono font-bold text-slate-900">{booking.id.substring(0, 10).toUpperCase()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Date & Time</span>
              <span className="font-bold text-slate-900">{booking.date} @ {booking.time}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Guest Count</span>
              <span className="font-bold text-slate-900">{booking.guests} Guests</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Customer Name</span>
              <span className="font-bold text-slate-900">{booking.customerName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone</span>
              <span className="font-mono text-slate-900">{booking.customerPhone}</span>
            </div>
            {booking.customerEmail && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email</span>
                <span className="text-slate-900">{booking.customerEmail}</span>
              </div>
            )}
          </div>

          {/* Billing Breakdown */}
          <div className="space-y-1.5 pt-2 border-t border-dashed border-slate-200">
            <div className="flex justify-between items-center text-slate-500">
              <span>Table Reservation Fee</span>
              <span>₹0.00</span>
            </div>
            <div className="flex justify-between items-center text-slate-500">
              <span>Applicable GST / Taxes</span>
              <span>₹0.00</span>
            </div>
            <div className="flex justify-between items-center text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>Total Booking Amount</span>
              <span className="text-emerald-700">₹0.00 (FREE)</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" /> Print Receipt
          </button>
        </div>
      </div>
    </div>
  );
};

