import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // Usaremos Auth
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCaExyTGWpYis1Oy3UefW5PC3c8WITBkAE",
  authDomain: "restapp-eb48f.firebaseapp.com",
  projectId: "restapp-eb48f",
  storageBucket: "restapp-eb48f.firebasestorage.app",
  messagingSenderId: "845257718313",
  appId: "1:845257718313:web:2279b37375896b84093a38"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
