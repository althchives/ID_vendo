import { getDatabase, ref, get, set, onValue, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

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
const db = getDatabase(app, "https://pigate-4ed8c-default-rtdb.asia-southeast1.firebasedatabase.app/");

const DEFAULT_CUBBIES = [
  { id: 1, occupied: false, visitor: null },
  { id: 2, occupied: false, visitor: null },
  { id: 3, occupied: false, visitor: null },
  { id: 4, occupied: false, visitor: null },
  { id: 5, occupied: false, visitor: null },
  { id: 6, occupied: false, visitor: null }
];

class KioskBackend {
  constructor() {
    this.cubbies = JSON.parse(localStorage.getItem("kiosk_cubbies")) || structuredClone(DEFAULT_CUBBIES);
    this.isLive = false;
    this.onChangeCallback = null;
  }

  async init(onChange) {
    this.onChangeCallback = onChange;

    try {
      const stateRef = ref(db, "kiosk/cubbyState");
      const snap = await get(stateRef);
      
      if (!snap.exists()) {
        await set(stateRef, { cubbies: DEFAULT_CUBBIES, updatedAt: Date.now() });
      }

      // Listen in real-time for changes to cubby state
      onValue(stateRef, (snapshot) => {
        const data = snapshot.val();
        if (data && Array.isArray(data.cubbies)) {
          this.cubbies = data.cubbies;
          localStorage.setItem("kiosk_cubbies", JSON.stringify(this.cubbies));
          this.setStatus(true, "Firebase Live");
          this.notify();
        }
      });
    } catch (err) {
      console.warn("Firebase connection fallback:", err);
      this.setStatus(false, "Offline Fallback Mode");
      this.notify();
    }
  }

  setStatus(live, text) {
    this.isLive = live;
    const dot = document.getElementById("fbDot");
    const label = document.getElementById("fbLabel");
    if (dot) dot.className = live ? "dot live" : "dot offline";
    if (label) label.textContent = text;
  }

  notify() {
    if (this.onChangeCallback) this.onChangeCallback(this.cubbies);
  }

  async saveCubbies(updatedCubbies, logEvent = null) {
    this.cubbies = updatedCubbies;
    localStorage.setItem("kiosk_cubbies", JSON.stringify(updatedCubbies));
    this.notify();

    try {
      // Update cubby state in Realtime Database
      await set(ref(db, "kiosk/cubbyState"), {
        cubbies: updatedCubbies,
        updatedAt: Date.now()
      });

      if (logEvent && logEvent.action === "DEPOSIT") {
        await set(ref(db, "kiosk/commands"), {
          action: "open_cubby",
          cubby_id: logEvent.cubbyId,
          timestamp: Date.now()
        });
      }

      if (logEvent) {
        await push(ref(db, "kioskLogs"), {
          ...logEvent,
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error("Realtime Database sync error:", err);
    }
  }

  async depositToCubby(cubbyId, visitorData) {
    const next = this.cubbies.map((c) =>
      c.id === cubbyId ? { ...c, occupied: true, visitor: visitorData } : c
    );
    await this.saveCubbies(next, { action: "DEPOSIT", cubbyId, visitor: visitorData });
  }

  async withdrawFromCubby(cubbyId) {
    const target = this.cubbies.find((c) => c.id === cubbyId);
    const next = this.cubbies.map((c) =>
      c.id === cubbyId ? { ...c, occupied: false, visitor: null } : c
    );
    await this.saveCubbies(next, { action: "WITHDRAW", cubbyId, visitor: target ? target.visitor : null });
  }

  async resetAll() {
    await this.saveCubbies(structuredClone(DEFAULT_CUBBIES), { action: "RESET_ALL" });
  }
}

export const backend = new KioskBackend();