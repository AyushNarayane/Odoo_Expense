// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCULaT6B3A_QhkTVLlQfavtZmFf5JTTMag",
  authDomain: "odooexpense.firebaseapp.com",
  projectId: "odooexpense",
  storageBucket: "odooexpense.firebasestorage.app",
  messagingSenderId: "781036940657",
  appId: "1:781036940657:web:d4a600d57f464f86bc1ad0",
  measurementId: "G-SX7B1N21Z9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let analytics;
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

export { app, analytics, auth, db };
