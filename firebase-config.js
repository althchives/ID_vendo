import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCn5gfD0ewwlW3BCCdQ257wmP6y86Ry",
  authDomain: "pigate-4ed8c.firebaseapp.com",
  databaseURL: "https://pigate-4ed8c-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "pigate-4ed8c",
  storageBucket: "pigate-4ed8c.firebasestorage.app",
  messagingSenderId: "493528421844",
  appId: "1:493528421844:web:364aeb80b91660d864f"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Reference to the kiosk motion status node
const motionRef = ref(db, 'kiosk/motion_detected');

// Listen in real-time for changes from the Raspberry Pi PIR sensor
onValue(motionRef, (snapshot) => {
  const isMotionDetected = snapshot.val();
  console.log("Motion status changed:", isMotionDetected);

  if (isMotionDetected === true) {
    console.log("Motion sensed! Proceeding from Idle to Select Mode...");
    
    // Switch your UI screens based on your HTML element IDs
    const idleScreen = document.getElementById('idle-screen');
    const selectModeScreen = document.getElementById('select-mode-screen');

    if (idleScreen && selectModeScreen) {
      idleScreen.classList.add('hidden');
      selectModeScreen.classList.remove('hidden');
    }
  }
});