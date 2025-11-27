// Firebase Configuration
// Your actual Firebase project credentials

const firebaseConfig = {
    apiKey: "AIzaSyDeImJUCh1j1Azv3Hn9S3sys5V2-NvPGm8",
    authDomain: "poutry-management.firebaseapp.com",
    projectId: "poutry-management",
    storageBucket: "poutry-management.firebasestorage.app",
    messagingSenderId: "309045584840",
    appId: "1:309045584840:web:f4f431071c0f81670456fd",
    measurementId: "G-FTV04YHMEB"
};

// Initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
