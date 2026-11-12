import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDz3FJD9eDOUF8_bIa5xTnHvMUUdG-tMJw",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "food-delivery-app-b7e0b.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "food-delivery-app-b7e0b",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "food-delivery-app-b7e0b.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "776025753668",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:776025753668:web:a1278c1638b5d5afae5411",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-PQ2CSWNFRJ"
};

// Initialize primary Firebase app
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Helper function to create secondary Auth instance for creating manager credentials
export const getSecondaryAuth = () => {
  const secondaryAppName = "SecondaryManagerAuthApp";
  const secondaryApp = getApps().find((a) => a.name === secondaryAppName) || initializeApp(firebaseConfig, secondaryAppName);
  return getAuth(secondaryApp);
};

export default app;
