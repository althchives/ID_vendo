import { doc, getDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, firebaseConfig } from "./firebase-config.js";

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
    const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";

    if (!isConfigured) {
      this.setStatus(false, "Local Fallback (Add Firebase Config)");
      this.notify();
      return;
    }

    try {
      const stateRef = doc(db, "kiosk", "cubbyState");
      const snap = await getDoc(stateRef);
      if (!snap.exists()) {
        await setDoc(stateRef, { cubbies: DEFAULT_CUBBIES, updatedAt: serverTimestamp() });
      }

      onSnapshot(stateRef, (docSnap) => {
        if (docSnap.exists() && Array.isArray(docSnap.data().cubbies)) {
          this.cubbies = docSnap.data().cubbies;
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

    const isConfigured = firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY";
    if (this.isLive && isConfigured) {
      try {
        await setDoc(doc(db, "kiosk", "cubbyState"), {
          cubbies: updatedCubbies,
          updatedAt: serverTimestamp()
        });
        if (logEvent) {
          await addDoc(collection(db, "kioskLogs"), {
            ...logEvent,
            timestamp: serverTimestamp()
          });
        }
      } catch (err) {
        console.error("Firestore sync error:", err);
      }
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