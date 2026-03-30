// ============================================================
// Firebase Configuration
// Replace the placeholder values below with your actual
// Firebase project credentials from the Firebase Console.
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyCAxAVRIYmCd7VSXT6ZUaF6SOEjHnEzb68",
    authDomain: "lqess-3ae95.firebaseapp.com",
    projectId: "lqess-3ae95",
    storageBucket: "lqess-3ae95.firebasestorage.app",
    messagingSenderId: "605455957361",
    appId: "1:605455957361:web:e5c39ee35468d55cfc0ad0",
    measurementId: "G-CQVMQFFB5Z"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Global references
const auth = firebase.auth();
const db = firebase.firestore();

// Google Auth Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();
