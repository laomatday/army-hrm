import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyD0NtXfJf3RMaeX79BZzkcLqgBQKHskxlo",
  authDomain: "army-hrm-70615.firebaseapp.com",
  projectId: "army-hrm-70615",
  storageBucket: "army-hrm-70615.firebasestorage.app",
  messagingSenderId: "600287950138",
  appId: "1:600287950138:web:21de7495932c5b5f5acc03"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);