import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDxrTqoCwXFR7zy_BEK0sobN3sFTQ8hnA4",
  authDomain: "asistencia-3407b.firebaseapp.com",
  projectId: "asistencia-3407b",
  storageBucket: "asistencia-3407b.firebasestorage.app",
  messagingSenderId: "120892820831",
  appId: "1:120892820831:web:b4571cc4f4ab3ed1e3baea"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
