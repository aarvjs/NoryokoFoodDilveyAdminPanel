"use client";

import React, { useState } from "react";
import { 
  X, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle2, 
  UtensilsCrossed, 
  Calendar, 
  User, 
  Phone, 
  Loader2, 
  AlertCircle,
  ShoppingBag,
  Grid3X3,
  UserPlus
} from "lucide-react";
import { TableBooking, Product, RestaurantTable, OrderItem } from "@/types";
import { orderService } from "@/services/orderService";
import { tableService } from "@/services/tableService";

interface CounterTableOrderModalProps {
  branchId: string;
  branchName?: string;
  restaurantId?: string;
  bookings: TableBooking[];
  tables: RestaurantTable[];
  products: Product[];
  preSelectedBooking?: TableBooking | null;
  preSelectedTable?: RestaurantTable | null;
  onClose: () => void;
  onOrderPlaced?: (orderId: string) => void;
}

export const CounterTableOrderModal: React.FC<CounterTableOrderModalProps> = ({
  branchId,
  branchName = "Main Branch",
  restaurantId = "",
  bookings,
  tables,
  products,
  preSelectedBooking,
  preSelectedTable,
  onClose,
  onOrderPlaced,
}) => {
  // Mode selection: "WALK_IN" (book on spot) or "EXISTING_BOOKING" (prior online reservation)
  const [orderMode, setOrderMode] = useState<"WALK_IN" | "EXISTING_BOOKING">(
    preSelectedBooking ? "EXISTING_BOOKING" : "WALK_IN"
  );

  // Walk-In state
  const branchTables = tables.filter((t) => !branchId || t.branchId === branchId);
  const [walkInTableId, setWalkInTableId] = useState<string>(
    preSelectedTable?.id || branchTables[0]?.id || tables[0]?.id || ""
  );
  const [walkInCustomerName, setWalkInCustomerName] = useState("Walk-in Guest");
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState("+91 9876543210");
  const [walkInGuests, setWalkInGuests] = useState(2);

  // Existing booking state
  const [selectedBooking, setSelectedBooking] = useState<TableBooking | null>(preSelectedBooking || null);
  const [bookingSearch, setBookingSearch] = useState("");

  // Menu Search & Filters
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [foodTypeFilter, setFoodTypeFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");

  const [cartItems, setCartItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filter eligible bookings for this branch
  const activeBookings = bookings.filter((b) => {
    if (b.branchId && b.branchId !== branchId) return false;
    if (bookingSearch.trim()) {
      const q = bookingSearch.toLowerCase();
      const matchName = (b.customerName || "").toLowerCase().includes(q);
      const matchPhone = (b.customerPhone || "").includes(q);
      const matchTable = (b.tableNumber || "").toLowerCase().includes(q);
      const matchId = (b.id || "").toLowerCase().includes(q);
      return matchName || matchPhone || matchTable || matchId;
    }
    return true;
  });

  // Extract categories from products
  const categories = ["ALL", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  // Filter available branch products
  const filteredProducts = products.filter((p) => {
    if (p.branchId && p.branchId !== branchId && (!p.branchIds || !p.branchIds.includes(branchId))) {
      return false;
    }
    if (p.status === "INACTIVE" || p.stockStatus === "OUT_OF_STOCK") return false;

    if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;

    if (foodTypeFilter === "VEG" && p.foodType !== "Veg" && !p.isVeg) return false;
    if (foodTypeFilter === "NON_VEG" && p.foodType === "Veg" && p.isVeg) return false;

    if (menuSearch.trim()) {
      const q = menuSearch.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as { product: Product; quantity: number }[]
    );
  };

  const subtotal = cartItems.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
  const tax = Number((subtotal * 0.05).toFixed(2)); // Standard 5% GST
  const grandTotal = Number((subtotal + tax).toFixed(2));

  const handlePlaceOrder = async () => {
    if (orderMode === "EXISTING_BOOKING") {
      if (!selectedBooking) {
        alert("Please select a customer table reservation first.");
        return;
      }
      const st = (selectedBooking.status || "").toUpperCase();
      if (st === "CANCELLED" || st === "REJECTED" || st === "NO_SHOW") {
        alert(`Cannot place order: This booking has status "${selectedBooking.status}".`);
        return;
      }
    } else {
      if (!walkInTableId) {
        alert("Please select a dining table for this walk-in customer.");
        return;
      }
    }

    if (cartItems.length === 0) {
      alert("Please add at least one food item to the order.");
      return;
    }

    setSubmitting(true);

    try {
      const orderItems: OrderItem[] = cartItems.map((it) => ({
        productId: it.product.id,
        productName: it.product.name,
        quantity: it.quantity,
        price: it.product.price,
        image: it.product.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80",
      }));

      const now = new Date().toISOString();
      const orderNumber = "ORD-TBL-" + Math.floor(1000 + Math.random() * 9000);

      let effectiveBookingId = selectedBooking?.id || "";
      const effectiveTableId = orderMode === "WALK_IN" ? walkInTableId : selectedBooking!.tableId;
      const targetTable = tables.find((t) => t.id === effectiveTableId);
      const effectiveTableNumber = orderMode === "WALK_IN" 
        ? targetTable?.tableNumber || "T-01" 
        : selectedBooking!.tableNumber;
      const effectiveCustomerName = orderMode === "WALK_IN" 
        ? walkInCustomerName.trim() || "Walk-in Guest" 
        : selectedBooking!.customerName;
      const effectiveCustomerPhone = orderMode === "WALK_IN" 
        ? walkInCustomerPhone.trim() || "+91 9876543210" 
        : selectedBooking!.customerPhone;

      // In Walk-in mode: Create a table reservation session on the spot
      if (orderMode === "WALK_IN") {
        const createdBooking = await tableService.createTableBooking({
          branchId: targetTable?.branchId || branchId,
          tableId: effectiveTableId,
          tableNumber: effectiveTableNumber,
          customerName: effectiveCustomerName,
          customerPhone: effectiveCustomerPhone,
          date: now.split("T")[0],
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          guests: Number(walkInGuests) || 2,
          status: "CONFIRMED",
        });
        effectiveBookingId = createdBooking.id;
      }

      // Create the dine-in order with source = "COUNTER"
      const newOrder = await orderService.createOrder({
        orderNumber,
        restaurantId: targetTable?.restaurantId || restaurantId,
        branchId: targetTable?.branchId || branchId,
        branchName: branchName,
        customerName: effectiveCustomerName,
        customerPhone: effectiveCustomerPhone,
        customerAddress: `Dine-In • Table ${effectiveTableNumber}`,
        orderType: "DINE_IN" as any,
        orderSource: "COUNTER",
        bookingId: effectiveBookingId,
        tableId: effectiveTableId,
        tableNumber: effectiveTableNumber,
        items: orderItems,
        subtotal,
        tax,
        deliveryFee: 0,
        totalAmount: grandTotal,
        paymentMethod: "CASH_ON_DELIVERY", // Pay at counter
        paymentStatus: "PENDING",
        status: "ACCEPTED", // Counter staff confirms directly
        instructions: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      } as any);

      // Update table status to OCCUPIED
      if (effectiveTableId) {
        await tableService.updateTable(effectiveTableId, { status: "OCCUPIED" });
      }

      alert(`✅ Counter Order #${orderNumber} for Table ${effectiveTableNumber} created and sent to kitchen!`);
      if (onOrderPlaced) onOrderPlaced(newOrder.id);
      onClose();
    } catch (err: any) {
      alert("Failed to place counter order: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTableObj = tables.find((t) => t.id === walkInTableId);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-purple-500/30 text-purple-200 text-[10px] font-black uppercase rounded-full border border-purple-400/30">
                Counter Point of Sale
              </span>
              <span className="text-xs text-purple-200">Branch: {branchName}</span>
            </div>
            <h2 className="text-xl font-black tracking-tight mt-1">Manual Counter Table Order</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body: Left is Booking & Cart, Right is Menu */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* LEFT COLUMN: Booking Selector + Order Cart (5 cols) */}
          <div className="md:col-span-5 p-5 flex flex-col justify-between overflow-y-auto custom-scrollbar space-y-4">
            {/* Step 1: Mode Switcher */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-600" /> 1. Table & Customer Selection
                </span>
              </div>

              {/* Mode Toggle Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setOrderMode("WALK_IN")}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    orderMode === "WALK_IN"
                      ? "bg-white text-purple-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 text-purple-600" /> Walk-In (Book on Spot)
                </button>
                <button
                  type="button"
                  onClick={() => setOrderMode("EXISTING_BOOKING")}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    orderMode === "EXISTING_BOOKING"
                      ? "bg-white text-purple-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Online Reservation
                </button>
              </div>

              {/* Mode A: Walk-In Table Booking Form */}
              {orderMode === "WALK_IN" && (
                <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-3.5 space-y-2.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Select Table Number *</span>
                      {selectedTableObj && (
                        <span className="text-[10px] text-purple-700 font-bold">
                          Cap: {selectedTableObj.capacity}p • {selectedTableObj.type || "Indoor"} • {selectedTableObj.status}
                        </span>
                      )}
                    </label>
                    <select
                      value={walkInTableId}
                      onChange={(e) => setWalkInTableId(e.target.value)}
                      className="w-full p-2.5 bg-white border border-purple-300 rounded-xl font-black text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {branchTables.map((t) => (
                        <option key={t.id} value={t.id}>
                          TABLE {t.tableNumber} — ({t.capacity} Persons • {t.section || "Dining"} • {t.status})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={walkInCustomerName}
                        onChange={(e) => setWalkInCustomerName(e.target.value)}
                        placeholder="e.g. Walk-in Guest"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="text"
                        value={walkInCustomerPhone}
                        onChange={(e) => setWalkInCustomerPhone(e.target.value)}
                        placeholder="+91..."
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Guests Count</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={walkInGuests}
                      onChange={(e) => setWalkInGuests(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Mode B: Pick Existing Online Reservation */}
              {orderMode === "EXISTING_BOOKING" && (
                <>
                  {!selectedBooking ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                        <input
                          type="text"
                          value={bookingSearch}
                          onChange={(e) => setBookingSearch(e.target.value)}
                          placeholder="Search customer, phone, or table #..."
                          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>

                      <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                        {activeBookings.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400">
                            No active online bookings found. Switch to "Walk-In" above to seat on the spot!
                          </div>
                        ) : (
                          activeBookings.map((b) => (
                            <div
                              key={b.id}
                              onClick={() => setSelectedBooking(b)}
                              className="p-2.5 rounded-xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 cursor-pointer transition-all flex items-center justify-between text-xs"
                            >
                              <div>
                                <p className="font-bold text-slate-900">{b.customerName}</p>
                                <p className="text-[10px] text-slate-500 font-mono">
                                  {b.customerPhone} • {b.date} @ {b.time}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 rounded font-black text-[11px]">
                                  {b.tableNumber}
                                </span>
                                <p className="text-[9px] text-slate-400 mt-0.5">{b.guests} Guests</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-purple-700 uppercase">Selected Reservation</p>
                          <p className="font-black text-slate-900 text-sm">{selectedBooking.customerName}</p>
                          <p className="text-[10px] text-slate-500 font-mono">{selectedBooking.customerPhone}</p>
                        </div>
                        <div className="bg-purple-600 text-white rounded-xl px-3 py-1.5 text-center shadow-sm">
                          <p className="text-[9px] uppercase font-bold text-purple-200">Table</p>
                          <p className="text-base font-black">{selectedBooking.tableNumber}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-purple-100 text-[10px] text-slate-500">
                        <span>{selectedBooking.date} @ {selectedBooking.time} • {selectedBooking.guests} Guests</span>
                        <button
                          type="button"
                          onClick={() => setSelectedBooking(null)}
                          className="text-purple-600 font-bold hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Step 2: Order Cart */}
            <div className="space-y-3 pt-3 border-t border-slate-100 flex-1 flex flex-col">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-purple-600" /> 2. Selected Food Items ({cartItems.length})
              </span>

              <div className="flex-1 overflow-y-auto max-h-48 divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-slate-50/40 p-2 custom-scrollbar">
                {cartItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No food items added yet. Click items on the right menu to add.
                  </div>
                ) : (
                  cartItems.map(({ product, quantity }) => (
                    <div key={product.id} className="py-2 px-1 flex items-center justify-between text-xs">
                      <div className="pr-2 max-w-[180px]">
                        <p className="font-bold text-slate-900 truncate">{product.name}</p>
                        <p className="text-[10px] text-slate-500">₹{product.price} each</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleUpdateQuantity(product.id, -1)}
                            className="p-1 hover:bg-slate-100 text-slate-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-2 font-bold text-slate-900 text-xs">{quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(product.id, 1)}
                            className="p-1 hover:bg-slate-100 text-slate-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-bold text-slate-900 w-14 text-right">
                          ₹{(product.price * quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Special Instructions */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions for kitchen (optional)..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              {/* Price Calculation & Submit */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>GST (5%)</span>
                  <span>₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-black text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>Total Payable</span>
                  <span className="text-purple-700">₹{grandTotal.toFixed(2)}</span>
                </div>

                <button
                  onClick={handlePlaceOrder}
                  disabled={submitting || (orderMode === "EXISTING_BOOKING" && !selectedBooking) || cartItems.length === 0}
                  className="w-full mt-3 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UtensilsCrossed className="w-4 h-4" /> Send Counter Order to Kitchen KOT
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Branch Menu Selector (7 cols) */}
          <div className="md:col-span-7 p-5 flex flex-col overflow-hidden space-y-3">
            {/* Search & Food Type Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  placeholder="Search branch menu items..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[11px] font-bold">
                <button
                  onClick={() => setFoodTypeFilter("ALL")}
                  className={`px-2.5 py-1 rounded-lg ${foodTypeFilter === "ALL" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  All
                </button>
                <button
                  onClick={() => setFoodTypeFilter("VEG")}
                  className={`px-2.5 py-1 rounded-lg ${foodTypeFilter === "VEG" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500"}`}
                >
                  Veg
                </button>
                <button
                  onClick={() => setFoodTypeFilter("NON_VEG")}
                  className={`px-2.5 py-1 rounded-lg ${foodTypeFilter === "NON_VEG" ? "bg-rose-600 text-white shadow-sm" : "text-slate-500"}`}
                >
                  Non-Veg
                </button>
              </div>
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-full whitespace-nowrap font-bold text-[11px] transition-colors ${
                    selectedCategory === cat
                      ? "bg-purple-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Menu Items Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 custom-scrollbar pr-1 max-h-[500px]">
              {filteredProducts.length === 0 ? (
                <div className="col-span-2 py-16 text-center text-xs text-slate-400 space-y-1">
                  <UtensilsCrossed className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-600">No Food Items Available</p>
                  <p>Check the search keywords or category filters.</p>
                </div>
              ) : (
                filteredProducts.map((p) => {
                  const inCart = cartItems.find((it) => it.product.id === p.id);
                  return (
                    <div
                      key={p.id}
                      className="bg-white border border-slate-200 rounded-2xl p-3 flex gap-3 hover:border-purple-300 hover:shadow-sm transition-all"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        <img
                          src={p.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=300&auto=format&fit=crop&q=80"}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 flex flex-col justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                p.foodType === "Veg" || p.isVeg ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            <h4 className="font-bold text-slate-900 line-clamp-1">{p.name}</h4>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{p.category}</p>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50">
                          <span className="font-black text-slate-900 text-sm">₹{p.price}</span>

                          {inCart ? (
                            <div className="flex items-center bg-purple-50 border border-purple-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => handleUpdateQuantity(p.id, -1)}
                                className="p-1 text-purple-700 hover:bg-purple-100"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="px-2 font-bold text-purple-900 text-xs">{inCart.quantity}</span>
                              <button
                                onClick={() => handleUpdateQuantity(p.id, 1)}
                                className="p-1 text-purple-700 hover:bg-purple-100"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddToCart(p)}
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all"
                            >
                              <Plus className="w-3 h-3" /> Add
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
