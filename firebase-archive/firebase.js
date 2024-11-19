// Import the functions you need from the SDKs you need
const { initializeApp } = require('firebase/app');
// const { getAnalytics } = require('firebase/analytics');
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyCeXM1gWVSO6zVFjqItv8ybch1oEmKZLEM',
  authDomain: 'backend-dc59e.firebaseapp.com',
  projectId: 'backend-dc59e',
  storageBucket: 'backend-dc59e.firebasestorage.app',
  messagingSenderId: '331642864958',
  appId: '1:331642864958:web:4b8379d1344d055220d86f',
  measurementId: 'G-27F7LX7EDT',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);

module.exports = { app };
