import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const testFirebase = async () => {
  try {
    await addDoc(collection(db, 'rides'), {
      client: 'Mehdi',
      phone: '+213555000000',
      service: 'Aéroport',
      departure: 'Guelma',
      destination: 'Annaba',
      price: '4000 DA',
      time: '19:30',
      status: 'En attente',
      createdAt: new Date(),
    });

    console.log('Course envoyée avec succès 🚖');
  } catch (error) {
    console.log('Erreur Firebase:', error);
  }
};