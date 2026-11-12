import { db } from "@/firebase/config";
import { 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from "firebase/firestore";
import { RestaurantTable, TableBooking, TableBookingStatus, Order } from "@/types";
import { generateTableQr, getReachableBaseUrl, isLocalhost } from "@/lib/utils/qrUtils";
import QRCode from "qrcode";

const TABLES_COLLECTION = "tables";
const BOOKINGS_COLLECTION = "tableBookings";
const ORDERS_COLLECTION = "orders";

export const tableService = {
  // --- TABLE OPERATIONS ---
  getTables: async (): Promise<RestaurantTable[]> => {
    try {
      const snap = await getDocs(collection(db, TABLES_COLLECTION));
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as RestaurantTable));
    } catch (e) {
      console.warn("getTables error:", e);
      return [];
    }
  },

  subscribeToTables: (callback: (tables: RestaurantTable[]) => void, onError?: (err: any) => void) => {
    return onSnapshot(
      collection(db, TABLES_COLLECTION),
      (snap) => {
        const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as RestaurantTable));
        callback(items);
      },
      (err) => {
        console.warn("Firestore Snapshot Permission Notice (tables):", err.message);
        if (onError) onError(err);
      }
    );
  },

  subscribeToBranchTables: (branchId: string, callback: (tables: RestaurantTable[]) => void, onError?: (err: any) => void) => {
    const q = query(collection(db, TABLES_COLLECTION), where("branchId", "==", branchId));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as RestaurantTable));
        callback(items);
      },
      (err) => {
        console.warn("Firestore Snapshot Permission Notice (branchTables):", err.message);
        if (onError) onError(err);
      }
    );
  },

  addTable: async (data: Partial<RestaurantTable>): Promise<RestaurantTable> => {
    const targetBranchId = data.branchId || "";
    const tableNumberVal = (data.tableNumber || "T-" + Math.floor(100 + Math.random() * 900)).trim();

    // Prevent duplicate table numbers within the same branch
    if (targetBranchId && tableNumberVal) {
      const existingSnap = await getDocs(
        query(collection(db, TABLES_COLLECTION), where("branchId", "==", targetBranchId))
      );
      const isDuplicate = existingSnap.docs.some(
        (docSnap) => (docSnap.data().tableNumber || "").toString().trim().toLowerCase() === tableNumberVal.toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Table number "${tableNumberVal}" already exists in this branch. Please choose a different table number.`);
      }
    }

    const docRef = doc(collection(db, TABLES_COLLECTION));
    const now = new Date().toISOString();

    // Automatically generate unique QR code and token for this table
    const qrResult = await generateTableQr(docRef.id, targetBranchId, data.restaurantId);

    const newTable: RestaurantTable = {
      id: docRef.id,
      restaurantId: data.restaurantId || "",
      branchId: targetBranchId,
      tableNumber: tableNumberVal,
      capacity: Number(data.capacity) || 4,
      section: data.section || "Main Dining",
      type: data.type || "Indoor",
      environment: data.environment || "AC",
      status: data.status || "AVAILABLE",
      isActive: data.isActive !== undefined ? data.isActive : true,
      qrCodeKey: qrResult.qrCodeKey,
      qrCodeUrl: qrResult.qrCodeUrl,
      qrDataUrl: qrResult.qrDataUrl,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(docRef, newTable);
    return newTable;
  },

  updateTable: async (id: string, updated: Partial<RestaurantTable>): Promise<void> => {
    const docRef = doc(db, TABLES_COLLECTION, id);

    // If updating table number, check for duplicate within the same branch
    if (updated.tableNumber && updated.branchId) {
      const existingSnap = await getDocs(
        query(collection(db, TABLES_COLLECTION), where("branchId", "==", updated.branchId))
      );
      const isDuplicate = existingSnap.docs.some(
        (docSnap) =>
          docSnap.id !== id &&
          (docSnap.data().tableNumber || "").toString().trim().toLowerCase() === updated.tableNumber!.trim().toLowerCase()
      );
      if (isDuplicate) {
        throw new Error(`Table number "${updated.tableNumber}" already exists in this branch. Please choose a different table number.`);
      }
    }

    // Preserve existing QR code unless explicitly regenerating
    const payload: Partial<RestaurantTable> = {
      ...updated,
      updatedAt: new Date().toISOString()
    };

    await updateDoc(docRef, payload);
  },

  /**
   * Check if table currently has active reservations or ongoing orders
   */
  checkActiveTableSessions: async (
    tableId: string
  ): Promise<{ hasActiveBooking: boolean; hasActiveOrder: boolean; activeBookingsCount: number; activeOrdersCount: number }> => {
    let activeBookingsCount = 0;
    let activeOrdersCount = 0;

    try {
      // Check active bookings
      const bSnap = await getDocs(
        query(collection(db, BOOKINGS_COLLECTION), where("tableId", "==", tableId))
      );
      activeBookingsCount = bSnap.docs.filter((d) => {
        const st = (d.data().status || "").toUpperCase();
        return st === "PENDING" || st === "ACCEPTED" || st === "CONFIRMED";
      }).length;

      // Check active orders
      const oSnap = await getDocs(
        query(collection(db, ORDERS_COLLECTION), where("tableId", "==", tableId))
      );
      activeOrdersCount = oSnap.docs.filter((d) => {
        const st = (d.data().status || "").toUpperCase();
        return st === "PENDING" || st === "ACCEPTED" || st === "PREPARING" || st === "READY";
      }).length;
    } catch (e) {
      console.warn("checkActiveTableSessions notice:", e);
    }

    return {
      hasActiveBooking: activeBookingsCount > 0,
      hasActiveOrder: activeOrdersCount > 0,
      activeBookingsCount,
      activeOrdersCount
    };
  },

  /**
   * Toggle Table ON/OFF (Active/Inactive)
   */
  toggleTableActive: async (tableId: string, nextActiveState: boolean): Promise<void> => {
    const docRef = doc(db, TABLES_COLLECTION, tableId);
    await updateDoc(docRef, {
      isActive: nextActiveState,
      updatedAt: new Date().toISOString()
    });
  },

  /**
   * Fetch all orders placed for a specific table session
   */
  getTableOrders: async (tableId: string): Promise<Order[]> => {
    try {
      const q = query(collection(db, ORDERS_COLLECTION), where("tableId", "==", tableId));
      const snap = await getDocs(q);
      const orders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
      orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return orders;
    } catch (e) {
      console.warn("getTableOrders error:", e);
      return [];
    }
  },

  /**
   * Release a dining table when the guest finishes and bill is settled
   */
  releaseTableSession: async (tableId: string, bookingId?: string): Promise<void> => {
    const tableRef = doc(db, TABLES_COLLECTION, tableId);
    await updateDoc(tableRef, {
      status: "AVAILABLE",
      updatedAt: new Date().toISOString()
    });

    if (bookingId) {
      const bookingRef = doc(db, BOOKINGS_COLLECTION, bookingId);
      await updateDoc(bookingRef, {
        status: "COMPLETED",
        updatedAt: new Date().toISOString()
      });
    }
  },

  deleteTable: async (id: string): Promise<void> => {
    const docRef = doc(db, TABLES_COLLECTION, id);
    await deleteDoc(docRef);
  },

  // --- BOOKING OPERATIONS ---
  getTableBookings: async (): Promise<TableBooking[]> => {
    try {
      const q = query(collection(db, BOOKINGS_COLLECTION), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TableBooking));
    } catch (e) {
      console.warn("getTableBookings error:", e);
      return [];
    }
  },

  subscribeToBookings: (callback: (bookings: TableBooking[]) => void, onError?: (err: any) => void) => {
    return onSnapshot(
      collection(db, BOOKINGS_COLLECTION),
      (snap) => {
        const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TableBooking));
        items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        callback(items);
      },
      (err) => {
        console.warn("Firestore Snapshot Permission Notice (bookings):", err.message);
        if (onError) onError(err);
      }
    );
  },

  subscribeToBranchBookings: (branchId: string, callback: (bookings: TableBooking[]) => void, onError?: (err: any) => void) => {
    if (!branchId) {
      callback([]);
      return () => {};
    }
    const q = query(collection(db, BOOKINGS_COLLECTION), where("branchId", "==", branchId));
    return onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TableBooking));
        items.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        callback(items);
      },
      (err) => {
        console.warn("Firestore Snapshot Notice (branchBookings):", err.message);
        if (onError) onError(err);
      }
    );
  },

  createTableBooking: async (data: Partial<TableBooking>): Promise<TableBooking> => {
    const docRef = doc(collection(db, BOOKINGS_COLLECTION));
    const now = new Date().toISOString();

    const newBooking: TableBooking = {
      id: docRef.id,
      branchId: data.branchId || "",
      tableId: data.tableId || "",
      tableNumber: data.tableNumber || "T-101",
      customerName: data.customerName || "Guest Customer",
      customerPhone: data.customerPhone || "+91 9876543210",
      customerEmail: data.customerEmail || "",
      date: data.date || now.split("T")[0],
      time: data.time || "07:30 PM",
      guests: data.guests || 2,
      status: data.status || "PENDING",
      createdAt: now,
      updatedAt: now
    };

    await setDoc(docRef, newBooking);

    // If booking assigned to specific table, update table status to RESERVED
    if (data.tableId) {
      await updateDoc(doc(db, TABLES_COLLECTION, data.tableId), { status: "RESERVED" });
    }

    return newBooking;
  },

  updateBookingStatus: async (
    id: string, 
    status: TableBookingStatus, 
    tableId?: string
  ): Promise<void> => {
    const docRef = doc(db, BOOKINGS_COLLECTION, id);
    await updateDoc(docRef, { status, updatedAt: new Date().toISOString() });

    if (tableId) {
      const isOccupiedOrBooked = status === "ACCEPTED" || status === "CONFIRMED";
      const isAvailable = status === "COMPLETED" || status === "CANCELLED" || status === "REJECTED" || status === "NO_SHOW";
      const tableStatus = isOccupiedOrBooked ? "BOOKED" : isAvailable ? "AVAILABLE" : "RESERVED";
      await updateDoc(doc(db, TABLES_COLLECTION, tableId), { status: tableStatus });
    }

    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const bookingData = snap.data();
        const customerId = bookingData.customerId || bookingData.userId;
        if (customerId) {
          let title = "Table Booking Update";
          let body = `Your table booking status for ${bookingData.date} at ${bookingData.time} is now ${status}.`;

          if (status === "ACCEPTED" || status === "CONFIRMED") {
            title = "Table Booking Accepted! 🪑🎉";
            body = `Your table reservation for ${bookingData.guests} guests on ${bookingData.date} at ${bookingData.time} has been accepted.`;
          } else if (status === "REJECTED") {
            title = "Table Booking Declined ❌";
            body = `Your table reservation for ${bookingData.date} at ${bookingData.time} could not be confirmed.`;
          } else if (status === "COMPLETED") {
            title = "Table Booking Completed ✨";
            body = `Thank you for dining with us! Your reservation is completed.`;
          } else if (status === "CANCELLED") {
            title = "Table Booking Cancelled ⚠️";
            body = `Your table reservation for ${bookingData.date} at ${bookingData.time} has been cancelled.`;
          }

          const notifRef = doc(collection(db, "notifications"));
          await setDoc(notifRef, {
            id: notifRef.id,
            userId: customerId,
            bookingId: id,
            title,
            body,
            type: "table_booking",
            read: false,
            createdAt: new Date().toISOString()
          });
        }
      }
    } catch (e) {
      console.warn("Failed to create booking notification document:", e);
    }
  },

  /**
   * Migrate / regenerate table QR codes with a reachable base URL.
   * Fixes any legacy localhost QR codes without breaking tableId or qrCodeKey.
   */
  migrateTableQrs: async (
    tables: RestaurantTable[],
    newBaseUrl?: string
  ): Promise<{ updatedCount: number; errors: string[] }> => {
    let updatedCount = 0;
    const errors: string[] = [];
    const effectiveBase = await getReachableBaseUrl(newBaseUrl);

    for (const t of tables) {
      try {
        const currentUrl = t.qrCodeUrl || "";
        if (newBaseUrl || isLocalhost(currentUrl) || !t.qrDataUrl) {
          const qrKey = t.qrCodeKey || `qr_${t.id.substring(0, 8)}_${Date.now().toString(36)}`;
          const fixedUrl = `${effectiveBase.replace(/\/$/, "")}/table-menu?tableId=${encodeURIComponent(t.id)}&qrKey=${encodeURIComponent(qrKey)}&branchId=${encodeURIComponent(t.branchId)}${t.restaurantId ? `&restaurantId=${encodeURIComponent(t.restaurantId)}` : ""}`;

          const newQrDataUrl = await QRCode.toDataURL(fixedUrl, {
            width: 600,
            margin: 2,
            errorCorrectionLevel: "H",
            color: { dark: "#0f172a", light: "#ffffff" },
          });

          const docRef = doc(db, TABLES_COLLECTION, t.id);
          await updateDoc(docRef, {
            qrCodeKey: qrKey,
            qrCodeUrl: fixedUrl,
            qrDataUrl: newQrDataUrl,
            updatedAt: new Date().toISOString(),
          });
          updatedCount++;
        }
      } catch (err: any) {
        errors.push(`Table ${t.tableNumber}: ${err.message}`);
      }
    }
    return { updatedCount, errors };
  }
};
