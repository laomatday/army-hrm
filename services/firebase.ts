
// Use global firebase object from CDN (loaded in index.html) to avoid ESM/Compat module resolution issues
declare global {
  interface Window {
    firebase: any;
  }
}

const firebase = window.firebase;

if (!firebase) {
    console.error("Firebase SDK not loaded. Please check network connection or index.html scripts.");
}

const firebaseConfig = {
  apiKey: "AIzaSyD0NtXfJf3RMaeX79BZzkcLqgBQKHskxlo",
  authDomain: "army-hrm-70615.firebaseapp.com",
  projectId: "army-hrm-70615",
  storageBucket: "army-hrm-70615.firebasestorage.app",
  messagingSenderId: "600287950138",
  appId: "1:600287950138:web:21de7495932c5b5f5acc03"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
// Attempt to enable persistence with multi-tab support
try {
    db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
        console.log("Persistence not available", err);
    });
} catch(e) {
    console.log("Persistence setup failed", e);
}

const storage = firebase.storage();

let messaging: any = null;
try {
  // Use function check for safety
  if (typeof firebase.messaging === 'function' && firebase.messaging.isSupported()) {
    messaging = firebase.messaging();
  }
} catch (e) {
  console.log("Messaging not supported or blocked");
}

export { firebase, db, storage, messaging };
