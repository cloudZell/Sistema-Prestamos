// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAjoRnEupxT6UX01-vhkKC1q-QRsxq38SA",
  authDomain: "prestamosapp-p01.firebaseapp.com",
  databaseURL: "https://prestamosapp-p01-default-rtdb.firebaseio.com",
  projectId: "prestamosapp-p01",
  storageBucket: "prestamosapp-p01.firebasestorage.app",
  messagingSenderId: "1036000925818",
  appId: "1:1036000925818:web:adff817778310b5e9003c3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Exportamos las instancias para usarlas en los controladores
export const auth = getAuth(app);
export const db = getDatabase(app);
