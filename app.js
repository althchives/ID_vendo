import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { backend } from "./kiosk_backend.js";
import { SCREENS } from "./screens.js";
import { renderIdle } from "./idle.js";
import { renderSelectMode } from "./select_mode.js";
import { renderDepositDetails } from "./deposit_details.js";

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

const state = {
  currentScreen: "01-idle",
  previousScreen: "01-idle",
  activeCubby: 1,
  form: { fullName: "", affiliation: "", purpose: "", contact: "" },
  scanErrorWarning: ""
};

let inactivityTimer = null;
function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (state.currentScreen !== "01-idle" && state.currentScreen !== "05-deposit-scan-rfid" && state.currentScreen !== "11-withdraw-scan-rfid") {
    inactivityTimer = setTimeout(() => {
      window.resetToIdle();
    }, 30000);
  }
}

window.addEventListener("keydown", (e) => {
  resetInactivityTimer();

  if (e.key === "Escape") {
    if (state.currentScreen !== "01-idle" && state.currentScreen !== "05-deposit-scan-rfid" && state.currentScreen !== "11-withdraw-scan-rfid") {
      window.goToScreen(state.previousScreen || "01-idle");
    }
    return;
  }

  if (e.key === "Enter") {
    if (state.currentScreen === "01-idle") {
      window.goToScreen("02-select-mode");
      set(ref(db, 'kiosk/state'), "02-select-mode").catch(err => console.error(err));
    } else if (state.currentScreen === "03-deposit-details") {
      window.submitDepositDetails();
    }
    return;
  }

  if (state.currentScreen === "02-select-mode") {
    if (e.key === "1") window.startDeposit();
    else if (e.key === "2") window.startWithdraw();
  }
});

["click", "mousemove", "touchstart"].forEach(evt => window.addEventListener(evt, resetInactivityTimer));

const stateRef = ref(db, 'kiosk/state');
const motionRef = ref(db, 'kiosk/motion_detected');
const lastScanRef = ref(db, 'kiosk/last_scan');
const cubbyStateRef = ref(db, 'kiosk/cubbyState');

let isInitialStateLoad = true;

onValue(stateRef, (snapshot) => {
  const currentState = snapshot.val();
  
  if (isInitialStateLoad) {
    isInitialStateLoad = false;
    window.goToScreen("01-idle");
    set(ref(db, 'kiosk/state'), "01-idle").catch(err => console.error(err));
    return;
  }

  if (state.currentScreen === "05-deposit-scan-rfid" || state.currentScreen === "11-withdraw-scan-rfid") return;

  if (currentState && currentState.startsWith("0")) {
    window.goToScreen(currentState);
  } else if (currentState === 'idle') {
    if (state.currentScreen !== "01-idle") window.goToScreen('01-idle');
  }
});

onValue(motionRef, (snapshot) => {
  if (snapshot.val() === true && state.currentScreen === "01-idle") {
    window.goToScreen('02-select-mode');
  }
});

onValue(lastScanRef, (snapshot) => {
  const scanData = snapshot.val();
  if (scanData && scanData.cubby) {
    if (state.currentScreen === "05-deposit-scan-rfid") {
      if (scanData.cubby === state.activeCubby) {
        state.scanErrorWarning = "";
        window.goToScreen("06-deposit-cubby-open");
      } else {
        state.scanErrorWarning = `The rfid card you scanned is incorrect. pls try again`;
        renderScreen();
      }
    } else if (state.currentScreen === "11-withdraw-scan-rfid") {
      const scannedCubby = scanData.cubby;
      const cubbyObj = backend.cubbies.find(c => c.id === scannedCubby);
      
      if (cubbyObj && cubbyObj.occupied) {
        state.activeCubby = scannedCubby;
        state.scanErrorWarning = "";
        window.goToScreen("14-withdraw-cubby-open");
      } else {
        state.scanErrorWarning = `The rfid card you scanned is incorrect. pls try again`;
        renderScreen();
      }
    }
  }
});

onValue(cubbyStateRef, (snapshot) => {
  const data = snapshot.val();
  if (data && Array.isArray(data.cubbies)) {
    backend.cubbies = data.cubbies;
    renderScreen();
  }
});

function renderCubbyGrid(highlightId = null, clickableMode = null) {
  return `
    <div class="cubby-grid" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; margin: 0 auto;">
      ${backend.cubbies.map((c) => {
        const isHighlighted = highlightId === c.id;
        const cls = ["cubby-pill", c.occupied ? "occupied" : "", isHighlighted ? "highlighted" : ""].join(" ");
        const subText = c.occupied ? (c.visitor?.fullName || "Occupied") : "Available";
        const clickAttr = clickableMode ? `onclick="window.handleCubbyClick(${c.id})"` : "";
        return `<div class="${cls}" ${clickAttr} style="text-align: center; width: 100%; max-width: 220px;"><span>Cubby #${c.id}</span><span class="cubby-sub">${subText}</span></div>`;
      }).join("")}
    </div>
  `;
}

function renderScreen() {
  const card = document.getElementById("kioskCard");
  const badge = document.getElementById("stateBadge");
  const screenMeta = SCREENS.find((s) => s.id === state.currentScreen);
  if (badge) badge.textContent = screenMeta?.badge || "Idle";

  const freeCount = backend.cubbies.filter((c) => !c.occupied).length;

  switch (state.currentScreen) {
    case "01-idle":
      state.form = { fullName: "", affiliation: "", purpose: "", contact: "" };
      state.scanErrorWarning = "";
      renderIdle(card, window.goToScreen);
      break;

    case "02-select-mode":
      state.scanErrorWarning = "";
      renderSelectMode(card, window.startDeposit, window.startWithdraw, renderCubbyGrid, freeCount, window.goToScreen);
      break;

    case "03-deposit-details":
      renderDepositDetails(card, state, window.submitDepositDetails, () => window.goToScreen("02-select-mode"));
      break;

    case "04-deposit-verifying":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <div class="spinner-ring" style="width: 48px; height: 48px; border-width: 4px; margin-bottom: 16px;"></div>
          <h2 class="screen-title" style="font-size: 38px; font-weight: 800; margin-bottom: 10px;">Checking availability...</h2>
          <p class="subtitle" style="font-size: 16px; color: var(--text-secondary);">Reading IR sensors &amp; preparing your session.</p>
        </div>
      `;
      break;

    case "05-deposit-scan-rfid":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <div class="status-icon-circle icon-scan" style="margin-bottom: 14px;">🪪</div>
          <h2 class="screen-title" style="font-size: 34px; font-weight: 800; margin-bottom: 8px;">Tap your RFID Visitor Pass</h2>
          <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 16px;">Hold the issued visitor card near the scanner to unlock <strong>Cubby #${state.activeCubby}</strong>.</p>
          <div class="spinner-ring" style="width: 40px; height: 40px; border-width: 4px; margin-bottom: 16px;"></div>
          ${state.scanErrorWarning ? `<div style="background-color: #ffe6e6; color: #d9534f; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; max-width: 450px; border: 1px solid #ebccd1;">${state.scanErrorWarning}</div>` : ''}
        </div>
      `;
      break;

    case "06-deposit-cubby-open":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <h2 class="screen-title" style="font-size: 32px; font-weight: 800; margin-bottom: 8px;">Cubby #${state.activeCubby} is open</h2>
          <p class="subtitle" style="font-size: 18px; font-weight: 600; color: var(--primary); margin-bottom: 24px;">Place card inside the specified cubby #${state.activeCubby}</p>
          <div class="spinner-ring" style="width: 40px; height: 40px; border-width: 4px; margin-bottom: 20px;"></div>
          <div class="cubby-status-text" style="font-size: 14px; font-weight: 500; color: var(--text-secondary);">Waiting for IR sensor detection...</div>
        </div>
      `;
      break;

    case "07-deposit-close-door":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <div class="status-icon-circle icon-success" style="margin-bottom: 14px;">✅</div>
          <h2 class="screen-title" style="font-size: 34px; font-weight: 800; margin-bottom: 8px;">Deposit Complete!</h2>
          <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 20px;">Your ID is safely stored in <strong>Cubby #${state.activeCubby}</strong>.</p>
          <button class="btn-primary" style="min-width:200px;" onclick="window.resetToIdle()">Done</button>
        </div>
      `;
      break;

    case "10-deposit-complete":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <div class="status-icon-circle icon-success" style="margin-bottom: 14px;">✅</div>
          <h2 class="screen-title" style="font-size: 34px; font-weight: 800; margin-bottom: 8px;">Deposit complete!</h2>
          <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 20px;">Your ID is safely stored in <strong>Cubby #${state.activeCubby}</strong>.</p>
          <button class="btn-primary" style="min-width:200px;" onclick="window.resetToIdle()">Done</button>
        </div>
      `;
      break;

    case "11-withdraw-scan-rfid":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <div class="status-icon-circle icon-scan" style="margin-bottom: 14px;">📡</div>
          <h2 class="screen-title" style="font-size: 34px; font-weight: 800; margin-bottom: 8px;">Scan your RFID Visitor Pass</h2>
          <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 16px;">Tap your visitor card on the reader to open your assigned cubby.</p>
          <div class="spinner-ring" style="width: 40px; height: 40px; border-width: 4px; margin-bottom: 16px;"></div>
          ${state.scanErrorWarning ? `<div style="background-color: #ffe6e6; color: #d9534f; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; max-width: 450px; border: 1px solid #ebccd1;">${state.scanErrorWarning}</div>` : ''}
        </div>
      `;
      break;

    case "14-withdraw-cubby-open":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <h2 class="screen-title" style="font-size: 32px; font-weight: 800; margin-bottom: 8px;">Take your ID from Cubby #${state.activeCubby}</h2>
          <button class="btn-primary" style="min-width:240px; margin-bottom: 24px;" onclick="window.completeWithdraw()">ID Removed &amp; Close Door</button>
          <div style="width: 100%; max-width: 320px;">
            ${renderCubbyGrid(state.activeCubby)}
          </div>
        </div>
      `;
      break;

    case "18-withdraw-complete":
      card.innerHTML = `
        <div class="center-stage" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%; height: 100%;">
          <div class="status-icon-circle icon-success" style="margin-bottom: 14px;">🎉</div>
          <h2 class="screen-title" style="font-size: 34px; font-weight: 800; margin-bottom: 8px;">Thank you for visiting!</h2>
          <button class="btn-primary" style="min-width:200px;" onclick="window.resetToIdle()">Finish</button>
        </div>
      `;
      break;
  }
  renderBottomNav();
}

function renderBottomNav() {
  const nav = document.getElementById("screenNav");
  if (nav) {
    nav.innerHTML = SCREENS.map((s) => `
      <button class="nav-chip ${state.currentScreen === s.id ? "active" : ""}" onclick="window.goToScreen('${s.id}')">
        ${s.num} · ${s.label}
      </button>
    `).join("");
  }
}

window.goToScreen = (screenId) => {
  if (screenId !== state.currentScreen) state.previousScreen = state.currentScreen;
  state.currentScreen = screenId;
  resetInactivityTimer();
  renderScreen();
};

window.resetToIdle = () => {
  window.goToScreen("01-idle");
  set(ref(db, 'kiosk/state'), "01-idle").catch(err => console.error(err));
};

window.startDeposit = () => {
  const openCubby = backend.cubbies.find((c) => !c.occupied);
  state.activeCubby = openCubby ? openCubby.id : 1;
  state.scanErrorWarning = "";
  window.goToScreen("03-deposit-details");
};

window.startWithdraw = async () => {
  state.scanErrorWarning = "";
  window.goToScreen("11-withdraw-scan-rfid");
  try {
    await set(ref(db, 'kiosk/commands'), {
      action: "start_withdraw",
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Failed to send start_withdraw command:", err);
  }
};

window.submitDepositDetails = async () => {
  const name = document.getElementById("inpName")?.value.trim() || "";
  const affiliation = document.getElementById("inpAffiliation")?.value.trim() || "";
  const purpose = document.getElementById("inpPurpose")?.value.trim() || "";
  const contact = document.getElementById("inpContact")?.value.trim() || "";
  const errorMsg = document.getElementById("errorMsg");

  if (!name || !affiliation || !purpose || !contact) {
    if (errorMsg) errorMsg.textContent = "There are still missing fields, please fill them out.";
    return;
  }

  state.form = { fullName: name, affiliation, purpose, contact };
  state.scanErrorWarning = "";
  window.goToScreen("04-deposit-verifying");

  try {
    await set(ref(db, 'kiosk/commands'), {
      action: "start_deposit",
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Failed to send start_deposit command:", err);
  }
};

window.completeDeposit = async () => {
  await backend.depositToCubby(state.activeCubby, { ...state.form });
  window.goToScreen("10-deposit-complete");
  set(ref(db, 'kiosk/state'), "01-idle").catch(err => console.error(err));
};

window.completeWithdraw = async () => {
  await backend.withdrawFromCubby(state.activeCubby);
  window.goToScreen("18-withdraw-complete");
  set(ref(db, 'kiosk/state'), "01-idle").catch(err => console.error(err));
};

backend.init(() => renderScreen());
renderScreen();