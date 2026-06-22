import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDBXlO9v0ECZtyDXVCcx4ukLkf-rPxl0HE",
  authDomain: "cadenafrio.firebaseapp.com",
  projectId: "cadenafrio",
  storageBucket: "cadenafrio.firebasestorage.app",
  messagingSenderId: "666585058735",
  appId: "1:666585058735:web:3601ee3b941da7c67a335a",
  measurementId: "G-4H7697P55M"
};


const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };