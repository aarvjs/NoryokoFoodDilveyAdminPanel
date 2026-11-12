"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { 
  UtensilsCrossed, 
  Search, 
  Plus, 
  Minus, 
  ShoppingBag, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ChefHat, 
  Sparkles,
  Phone,
  User,
  ArrowRight,
  Loader2,
  FileText
} from "lucide-react";
import { db } from "@/firebase/config";
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc 
} from "firebase/firestore";
import { RestaurantTable, Product, OrderItem } from "@/types";

function TableMenuContent() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("tableId") || "";
  const qrKey = searchParams.get("qrKey") || "";
  const branchIdParam = searchParams.get("branchId") || "";

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [branch, setBranch] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);

  // Search & Categories
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [foodTypeFilter, setFoodTypeFilter] = useState<"ALL" | "VEG" | "NON_VEG">("ALL");

  // Cart
  const [cartItems, setCartItems] = useState<{ product: Product; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cookingNotes, setCookingNotes] = useState("");
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [placedOrderNumber, setPlacedOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    // Restore customer info from localStorage if available
    try {
      const savedName = localStorage.getItem("noryoko_guest_name");
      const savedPhone = localStorage.getItem("noryoko_guest_phone");
      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(savedPhone);
    } catch (_) {}

    validateAndLoadMenu();
  }, [tableId, qrKey]);

  const validateAndLoadMenu = async () => {
    if (!tableId) {
      setErrorMsg("No table specified in QR code. Please scan a valid table QR code.");
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch and validate table
      const tableSnap = await getDoc(doc(db, "tables", tableId));
      if (!tableSnap.exists()) {
        setErrorMsg("Table record not found in system. Please contact restaurant staff.");
        setLoading(false);
        return;
      }

      const tableData = { id: tableSnap.id, ...tableSnap.data() } as RestaurantTable;

      // 2. Validate QR Key (Security check against spoofing)
      if (tableData.qrCodeKey && qrKey && tableData.qrCodeKey !== qrKey) {
        setErrorMsg("Invalid or expired table QR code. Please scan the current QR code on the table.");
        setLoading(false);
        return;
      }

      // 3. Validate Table Active State
      if (tableData.isActive === false) {
        setErrorMsg(`Table ${tableData.tableNumber} is currently not active for dining. Please consult your server.`);
        setLoading(false);
        return;
      }

      setTable(tableData);
      const effectiveBranchId = tableData.branchId || branchIdParam;

      // 4. Fetch Branch Information
      if (effectiveBranchId) {
        try {
          const branchSnap = await getDoc(doc(db, "branches", effectiveBranchId));
          if (branchSnap.exists()) {
            const bData = branchSnap.data();
            if (bData.tableBookingEnabled === false) {
              setErrorMsg(`Dine-in table ordering is currently disabled for this branch (${bData.name}).`);
              setLoading(false);
              return;
            }
            setBranch(bData);
          }
        } catch (e) {
          console.warn("Branch fetch notice:", e);
        }
      }

      // 5. Fetch Restaurant info
      if (tableData.restaurantId) {
        try {
          const rSnap = await getDoc(doc(db, "restaurants", tableData.restaurantId));
          if (rSnap.exists()) {
            setRestaurant(rSnap.data());
          }
        } catch (_) {}
      }

      // 6. Fetch Menu Items available for catalogue
      const menuSnap = await getDocs(collection(db, "menuItems"));
      const allItems = menuSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));

      // Filter for this branch & catalogue enabled
      const availableItems = allItems.filter((p) => {
        if (effectiveBranchId && p.branchId && p.branchId !== effectiveBranchId && (!p.branchIds || !p.branchIds.includes(effectiveBranchId))) {
          return false;
        }
        if (p.status === "INACTIVE" || p.stockStatus === "OUT_OF_STOCK") return false;
        if (p.inCatalogue === false) return false;
        return true;
      });

      setProducts(availableItems);
    } catch (err: any) {
      console.error("Error loading QR menu:", err);
      setErrorMsg("Failed to load table catalogue: " + (err.message || "Network error."));
    } finally {
      setLoading(false);
    }
  };

  const categories = ["ALL", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  const filteredProducts = products.filter((p) => {
    if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;
    if (foodTypeFilter === "VEG" && p.foodType !== "Veg" && !p.isVeg) return false;
    if (foodTypeFilter === "NON_VEG" && p.foodType === "Veg" && p.isVeg) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
    }
    return true;
  });

  const handleAddToCart = (product: Product) => {
    setCartItems((prev) => {
      const existing = prev.find((it) => it.product.id === product.id);
      if (existing) {
        return prev.map((it) => (it.product.id === product.id ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.product.id === productId) {
            const next = it.quantity + delta;
            return next > 0 ? { ...it, quantity: next } : null;
          }
          return it;
        })
        .filter(Boolean) as { product: Product; quantity: number }[]
    );
  };

  const totalItemCount = cartItems.reduce((sum, it) => sum + it.quantity, 0);
  const subtotal = cartItems.reduce((sum, it) => sum + it.product.price * it.quantity, 0);
  const tax = Number((subtotal * 0.05).toFixed(2));
  const grandTotal = Number((subtotal + tax).toFixed(2));

  const handlePlaceOrder = async () => {
    if (!customerName.trim()) {
      alert("Please enter your name so our staff can identify your table.");
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      alert("Please enter a valid 10-digit mobile number.");
      return;
    }
    if (cartItems.length === 0) {
      alert("Your cart is empty. Please add items to place an order.");
      return;
    }
    if (!table) {
      alert("Table validation error. Please scan the QR code again.");
      return;
    }

    setSubmittingOrder(true);
    try {
      // Save customer info in localStorage for convenience
      try {
        localStorage.setItem("noryoko_guest_name", customerName.trim());
        localStorage.setItem("noryoko_guest_phone", customerPhone.trim());
      } catch (_) {}

      const orderNumber = "ORD-QR-" + Math.floor(1000 + Math.random() * 9000);
      const now = new Date().toISOString();

      const orderItems: OrderItem[] = cartItems.map((it) => ({
        productId: it.product.id,
        productName: it.product.name,
        quantity: it.quantity,
        price: it.product.price,
        image: it.product.image,
      }));

      const orderDocRef = doc(collection(db, "orders"));
      const newOrder = {
        id: orderDocRef.id,
        orderNumber,
        restaurantId: table.restaurantId || "",
        branchId: table.branchId || "",
        branchName: branch?.name || "Main Branch",
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: `Dine-In • Table ${table.tableNumber}`,
        orderType: "DINE_IN",
        orderSource: "QR",
        tableId: table.id,
        tableNumber: table.tableNumber,
        items: orderItems,
        subtotal,
        tax,
        deliveryFee: 0,
        totalAmount: grandTotal,
        paymentMethod: "CASH_ON_DELIVERY", // Pay at counter / after meal
        paymentStatus: "PENDING",
        status: "PENDING",
        instructions: cookingNotes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(orderDocRef, newOrder);

      // Update Table status to OCCUPIED
      await updateDoc(doc(db, "tables", table.id), {
        status: "OCCUPIED",
        updatedAt: now,
      });

      // Send alert notification to Kitchen and Staff
      try {
        const notifRef = doc(collection(db, "notifications"));
        await setDoc(notifRef, {
          id: notifRef.id,
          title: `🍽️ New QR Table Order: Table ${table.tableNumber}`,
          body: `${customerName.trim()} ordered ${totalItemCount} item(s) (₹${grandTotal}). Sent to Kitchen.`,
          branchId: table.branchId || "",
          orderId: orderDocRef.id,
          type: "table_order",
          read: false,
          createdAt: now,
        });
      } catch (_) {}

      setPlacedOrderNumber(orderNumber);
      setCartItems([]);
      setIsCartOpen(false);
    } catch (err: any) {
      alert("Failed to submit order: " + err.message);
    } finally {
      setSubmittingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-400" />
        <p className="text-sm font-bold text-slate-300">Loading Table Catalogue...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Table Ordering Unavailable</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{errorMsg}</p>
          <div className="pt-2">
            <p className="text-[11px] text-slate-400">Please speak with restaurant staff or scan again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28">
      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 py-3 shadow-sm">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-600/20">
              <UtensilsCrossed className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                {restaurant?.name || "Noryoko Food"}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                {branch?.name || "Main Dining Hall"}
              </p>
            </div>
          </div>

          {/* Prominent Verified Table Badge */}
          <div className="bg-emerald-600 text-white px-3.5 py-1.5 rounded-xl shadow-md shadow-emerald-600/20 text-center">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-200">Table</p>
            <p className="text-sm font-black leading-none">{table?.tableNumber}</p>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white rounded-3xl p-5 shadow-lg space-y-1 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-28 h-28 bg-emerald-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Direct Kitchen Ordering
          </div>
          <h2 className="text-xl font-black">Welcome to Table {table?.tableNumber}!</h2>
          <p className="text-xs text-emerald-100/90 leading-relaxed">
            Browse our digital menu below, add items to your cart, and place orders directly to our chefs.
          </p>
        </div>

        {/* Search & Food Type Filter */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, drinks, desserts..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-200 p-1 rounded-2xl text-xs font-bold">
            <button
              onClick={() => setFoodTypeFilter("ALL")}
              className={`flex-1 py-1.5 rounded-xl transition-colors ${
                foodTypeFilter === "ALL" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600"
              }`}
            >
              All Items
            </button>
            <button
              onClick={() => setFoodTypeFilter("VEG")}
              className={`flex-1 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1 ${
                foodTypeFilter === "VEG" ? "bg-emerald-600 text-white shadow-sm" : "text-emerald-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Veg
            </button>
            <button
              onClick={() => setFoodTypeFilter("NON_VEG")}
              className={`flex-1 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1 ${
                foodTypeFilter === "NON_VEG" ? "bg-rose-600 text-white shadow-sm" : "text-rose-700"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Non-Veg
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar text-xs">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full whitespace-nowrap font-bold text-xs transition-all ${
                selectedCategory === cat
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Food Items List */}
        <div className="space-y-3">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2 bg-white rounded-3xl border border-slate-200 p-6">
              <ChefHat className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700 text-sm">No items found</p>
              <p>Try searching for a different item or switch category.</p>
            </div>
          ) : (
            filteredProducts.map((p) => {
              const isVeg = p.foodType === "Veg" || p.isVeg;
              const cartEntry = cartItems.find((it) => it.product.id === p.id);

              return (
                <div
                  key={p.id}
                  className="bg-white border border-slate-200/90 rounded-3xl p-3.5 shadow-sm hover:shadow-md transition-all flex gap-3"
                >
                  <img
                    src={p.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&auto=format&fit=crop&q=80"}
                    alt={p.name}
                    className="w-24 h-24 rounded-2xl object-cover bg-slate-100 flex-shrink-0"
                  />

                  <div className="flex-1 flex flex-col justify-between py-0.5 overflow-hidden">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isVeg ? "bg-emerald-500" : "bg-rose-500"}`} />
                        <h3 className="font-bold text-slate-900 text-sm truncate">{p.name}</h3>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{p.description}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <p className="text-base font-black text-slate-900">₹{p.price}</p>

                      {cartEntry ? (
                        <div className="flex items-center bg-emerald-50 border border-emerald-300 rounded-xl overflow-hidden shadow-sm">
                          <button
                            onClick={() => handleUpdateQuantity(p.id, -1)}
                            className="px-2.5 py-1 text-emerald-800 hover:bg-emerald-100 active:scale-95"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 font-black text-emerald-950 text-xs">
                            {cartEntry.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateQuantity(p.id, 1)}
                            className="px-2.5 py-1 text-emerald-800 hover:bg-emerald-100 active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleAddToCart(p)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* Floating Bottom Cart Bar */}
      {totalItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
          <div className="max-w-md mx-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center font-black text-sm">
                  {totalItemCount}
                </div>
                <div className="text-left">
                  <p className="text-xs text-slate-300 font-medium">Table {table?.tableNumber} Order</p>
                  <p className="text-base font-black">₹{grandTotal.toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold bg-white/10 px-3 py-2 rounded-xl">
                <span>View Cart & Order</span>
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Checkout Drawer / Modal */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">Your Table Order</h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md">
                  Table {table?.tableNumber}
                </span>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1 custom-scrollbar text-xs">
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                {cartItems.map(({ product, quantity }) => (
                  <div key={product.id} className="p-3 flex items-center justify-between bg-white">
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{product.name}</p>
                      <p className="text-[10px] text-slate-500">₹{product.price} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                        <button
                          onClick={() => handleUpdateQuantity(product.id, -1)}
                          className="px-2 py-1 text-slate-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-bold text-slate-900">{quantity}</span>
                        <button
                          onClick={() => handleUpdateQuantity(product.id, 1)}
                          className="px-2 py-1 text-slate-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-bold text-slate-900 w-14 text-right">
                        ₹{(product.price * quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Guest Details */}
              <div className="space-y-2 pt-2">
                <p className="font-bold text-slate-900 text-xs">Guest Contact Information</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Your Name *"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                      placeholder="Mobile Number *"
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="relative">
                  <FileText className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={cookingNotes}
                    onChange={(e) => setCookingNotes(e.target.value)}
                    placeholder="Cooking notes (e.g. less spicy, no onions)..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Restaurant GST (5%)</span>
                  <span className="font-bold text-slate-900">₹{tax.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-slate-900">
                  <span>Grand Total</span>
                  <span className="text-emerald-700">₹{grandTotal.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-slate-400 pt-1">
                  Payment: Pay at counter or upon table billing.
                </p>
              </div>
            </div>

            {/* Submit Action */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
              <button
                onClick={handlePlaceOrder}
                disabled={submittingOrder}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {submittingOrder ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <ChefHat className="w-5 h-5" /> Send Order to Kitchen (₹{grandTotal.toFixed(2)})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      {placedOrderNumber && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">Order Sent to Kitchen!</h3>
              <p className="text-xs text-slate-600">
                Your order <strong className="text-slate-900">#{placedOrderNumber}</strong> for{" "}
                <strong className="text-emerald-700">Table {table?.tableNumber}</strong> has been received by our chefs.
              </p>
            </div>

            <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 flex items-center justify-center gap-1.5 font-bold">
              <Clock className="w-4 h-4" /> Estimated Prep Time: 15-25 Mins
            </div>

            <button
              onClick={() => setPlacedOrderNumber(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              Order More Items
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TableMenuPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      }
    >
      <TableMenuContent />
    </Suspense>
  );
}

