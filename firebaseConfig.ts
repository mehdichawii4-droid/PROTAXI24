import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCHQEB_GamG0xcZlmKxLF4jLX4-vuOx5hc",
  authDomain: "protaxi24-8abf2.firebaseapp.com",
  projectId: "protaxi24-8abf2",
  storageBucket: "protaxi24-8abf2.firebasestorage.app",
  messagingSenderId: "750646832518",
  appId: "1:750646832518:web:2ea2e798c86c3529031007"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

export default app;