
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyD0NtXfJf3RMaeX79BZzkcLqgBQKHskxlo",
  authDomain: "army-hrm-70615.firebaseapp.com",
  projectId: "army-hrm-70615",
  storageBucket: "army-hrm-70615.firebasestorage.app",
  messagingSenderId: "600287950138",
  appId: "1:600287950138:web:21de7495932c5b5f5acc03"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://firebasestorage.googleapis.com/v0/b/army-hrm-70615.firebasestorage.app/o/logo%2Flogo.png?alt=media'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
