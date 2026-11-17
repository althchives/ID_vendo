import { renderIdle } from "./idle.js";
import { renderSelectMode } from "./select_mode.js";
import { renderDepositDetails } from "./deposit_details.js";
import { renderScanRfid } from "./scan_rfid.js";
import { renderCubbyAction } from "./cubby_action.js";

const DEFAULT_CUBBIES = [
  { id: 1, occupied: false, visitor: null },
  { id: 2, occupied: false, visitor: null },
  { id: 3, occupied: false, visitor: null },
  { id: 4, occupied: false, visitor: null },
  { id: 5, occupied: false, visitor: null },
  { id: 6, occupied: false, visitor: null }
];

let cubbies = JSON.parse(localStorage.getItem("kiosk_cubbies")) || DEFAULT_CUBBIES;

const SCREENS = [
  { id: "01-idle", badge: "Idle", label: "Idle" },
  { id: "02-select-mode", badge: "Select mode", label: "Select Mode" },
  { id: "03-deposit-details", badge: "Deposit", label: "Deposit Details" },
  { id: "04-deposit-verifying", badge: "Deposit", label: "Verifying" },
  { id: "05-deposit-scan-rfid", badge: "Deposit", label: "Scan RFID" },
  { id: "06-deposit-cubby-open", badge: "Deposit", label: "Cubby Open" },
  { id: "07-deposit-close-door", badge: "Deposit", label: "Close Door" },
  { id: "08-deposit-door-warning", badge: "Warning", label: "Door Warning" },
  { id: "09-deposit-no-id-warning", badge: "Warning", label: "No ID Warning" },
  { id: "10-deposit-complete", badge: "Complete", label: "Deposit Done" },
  { id: "11-withdraw-scan-rfid", badge: "Withdraw", label: "Scan RFID" },
  { id: "12-withdraw-verifying", badge: "Withdraw", label: "Verifying" },
  { id: "13-withdraw-invalid-rfid", badge: "Warning", label: "Invalid RFID" },
  { id: "14-withdraw-cubby-open", badge: "Withdraw", label: "Take ID" },
  { id: "15-withdraw-close-door", badge: "Withdraw", label: "Close Door" },
  { id: "16-withdraw-id-still-inside", badge: "Warning", label: "ID Inside Warn" },
  { id: "17-withdraw-door-warning", badge: "Warning", label: "Return Card" },
  { id: "18-withdraw-complete", badge: "Complete", label: "All Done" }
];

const state = {
  currentScreen: "01-idle",
  activeCubby: 1,
  form: { fullName: "", affiliation: "", purpose: "", contact: "" }
};

function resetForm() {
  state.form = { fullName: "", affiliation: "", purpose: "", contact: "" };
}

let currentFocusIndex = 0;

function getFocusableElements() {
  const card = document.getElementById("kioskCard");
  return card ? Array.from(card.querySelectorAll("button, input, select, [tabindex='0']")) : [];
}

function updateFocus() {
  const focusables = getFocusableElements();
  focusables.forEach((el, idx) => {
    if (idx === currentFocusIndex) {
      el.classList.add("keyboard-focus");
      el.focus();
    } else {
      el.classList.remove("keyboard-focus");
    }
  });
}

function renderCubbyGrid(highlightId = null, clickable = false) {
  return `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; width:100%;">
      ${cubbies.map(c => `
        <div style="background:${c.occupied?'var(--pill-occupied-bg)':'var(--pill-bg)'}; border:1.5px solid ${c.occupied?'var(--pill-occupied-border)':'var(--pill-border)'}; border-radius:16px; padding:16px 12px; text-align:center; font-size:15px; font-weight:700;">
          <span>Cubby #${c.id}</span>
          <div style="font-size:12px; font-weight:600; color:var(--text-secondary); margin-top: 2px;">${c.occupied ? 'Occupied' : 'Available'}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderScreen() {
  const card = document.getElementById("kioskCard");
  const badge = document.getElementById("stateBadge");
  const meta = SCREENS.find(s => s.id === state.currentScreen);
  badge.textContent = meta?.badge || "Idle";
  const freeCount = cubbies.filter(c => !c.occupied).length;

  switch (state.currentScreen) {
    case "01-idle":
      renderIdle(card, window.goToScreen);
      break;
    case "02-select-mode":
      renderSelectMode(card, window.startDeposit, window.startWithdraw, renderCubbyGrid, freeCount, window.goToScreen);
      break;
    case "03-deposit-details":
      renderDepositDetails(card, state, window.submitDepositDetails, () => window.goToScreen("02-select-mode"));
      break;
    case "04-deposit-verifying":
      card.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
          <div class="spinner-ring" style="width:96px;height:96px;border-radius:50%;border:7px solid var(--pill-border);border-top-color:var(--accent-purple);animation:spin 0.95s linear infinite;margin-bottom:26px;"></div>
          <h2 class="screen-title" style="font-size:38px; font-weight:800; margin-bottom:10px;">Preparing your RFID ID</h2>
          <p class="subtitle" style="font-size:16px; color:var(--text-secondary);">Assigning an open cubby...</p>
        </div>
      `;
      setTimeout(() => { if (state.currentScreen === "04-deposit-verifying") window.goToScreen("05-deposit-scan-rfid"); }, 1000);
      break;
    case "05-deposit-scan-rfid":
      renderScanRfid(card, "Scan your RFID ID", `Take RFID ID #${state.activeCubby} from the tray and tap it on the reader.`, "Simulate RFID Tap", () => window.goToScreen("06-deposit-cubby-open"), () => window.goToScreen("03-deposit-details"));
      break;
    case "06-deposit-cubby-open":
      renderCubbyAction(card, `Cubby #${state.activeCubby} is unlocked`, "Open the door, place your outside ID inside, then close the door.", [
        { done: true, text: "Door opened" },
        { done: false, step: "2", text: "Outside ID placed (cubby occupied)" },
        { done: false, step: "3", text: "Door closed" }
      ], "Simulate ID Placed", () => window.goToScreen("07-deposit-close-door"), renderCubbyGrid, state.activeCubby);
      break;
    case "07-deposit-close-door":
      renderCubbyAction(card, `Cubby #${state.activeCubby} is unlocked`, "Open the door, place your outside ID inside, then close the door.", [
        { done: true, text: "Door opened" },
        { done: true, text: "Outside ID placed (cubby occupied)" },
        { done: false, step: "3", text: "Door closed" }
      ], "Close Door & Finish", () => window.completeDeposit(), renderCubbyGrid, state.activeCubby);
      break;
    case "10-deposit-complete":
      card.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
          <div class="status-icon-circle icon-success" style="width:104px;height:104px;border-radius:50%;background:var(--success-bg);color:var(--success-text);display:flex;align-items:center;justify-content:center;font-size:46px;margin-bottom:22px;">✅</div>
          <h2 class="screen-title" style="font-size:38px; font-weight:800; margin-bottom:10px;">Deposit complete</h2>
          <p class="subtitle" style="font-size:16px; color:var(--text-secondary); margin-bottom:28px; max-width:500px;">Thank you, ${state.form.fullName}. Cubby #${state.activeCubby} now holds your outside ID. Keep RFID ID #${state.activeCubby} safe.</p>
          <button class="btn-primary" onclick="window.goToScreen('01-idle')">Done</button>
        </div>
      `;
      break;
    case "11-withdraw-scan-rfid":
      renderScanRfid(card, "Do you have your RFID ID?", "You need the RFID ID you received at check-in.", "Yes, I have it", () => window.goToScreen("12-withdraw-verifying"), () => window.goToScreen("02-select-mode"));
      break;
    case "12-withdraw-verifying":
      card.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
          <div class="spinner-ring" style="width:96px;height:96px;border-radius:50%;border:7px solid var(--pill-border);border-top-color:var(--accent-purple);animation:spin 0.95s linear infinite;margin-bottom:26px;"></div>
          <h2 class="screen-title" style="font-size:38px; font-weight:800;">Verifying RFID pass...</h2>
        </div>
      `;
      setTimeout(() => { if (state.currentScreen === "12-withdraw-verifying") window.goToScreen("14-withdraw-cubby-open"); }, 1000);
      break;
    case "14-withdraw-cubby-open":
      renderCubbyAction(card, `Welcome back, ${state.form.fullName}`, `Cubby #${state.activeCubby} is unlocked. Open the door, take your outside ID, then close the door.`, [
        { done: true, text: "Door opened" },
        { done: false, step: "2", text: "Outside ID taken" },
        { done: false, step: "3", text: "Door closed" }
      ], "Simulate ID Taken", () => window.goToScreen("15-withdraw-close-door"), renderCubbyGrid, state.activeCubby);
      break;
    case "15-withdraw-close-door":
      renderCubbyAction(card, `Welcome back, ${state.form.fullName}`, `Cubby #${state.activeCubby} is unlocked. Open the door, take your outside ID, then close the door.`, [
        { done: true, text: "Door opened" },
        { done: true, text: "Outside ID taken" },
        { done: false, step: "3", text: "Door closed" }
      ], "Close Door & Return Pass", () => window.goToScreen("17-withdraw-return-pass"), renderCubbyGrid, state.activeCubby);
      break;
    case "17-withdraw-return-pass":
      renderScanRfid(card, "Return your RFID ID", "Drop the RFID ID into the return slot on top of the kiosk, next to the monitor.", "Simulate Pass Returned", () => window.completeWithdraw(), () => window.goToScreen("15-withdraw-close-door"));
      break;
    case "18-withdraw-complete":
      card.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
          <div class="status-icon-circle icon-success" style="width:104px;height:104px;border-radius:50%;background:var(--success-bg);color:var(--success-text);display:flex;align-items:center;justify-content:center;font-size:46px;margin-bottom:22px;">✅</div>
          <h2 class="screen-title" style="font-size:38px; font-weight:800; margin-bottom:10px;">All done</h2>
          <p class="subtitle" style="font-size:16px; color:var(--text-secondary); margin-bottom:28px; max-width:500px;">Thank you ${state.form.fullName}. Your outside ID was returned and your RFID ID is available again.</p>
          <button class="btn-primary" onclick="window.goToScreen('01-idle')">Finish</button>
        </div>
      `;
      break;
    default:
      card.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
          <div class="status-icon-warning">⚠️</div>
          <h2 style="font-size: 38px; font-weight: 800; margin-bottom: 10px;">${meta?.label || state.currentScreen}</h2>
          <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 28px; max-width: 500px;">Please check the kiosk status and try again.</p>
          <button class="btn-primary" onclick="window.goToScreen('01-idle')">Return to Idle</button>
        </div>
      `;
      break;
  }

  currentFocusIndex = 0;
  setTimeout(updateFocus, 50);
}

window.goToScreen = (id) => {
  if (id === "01-idle") {
    resetForm();
  }
  state.currentScreen = id;
  renderScreen();
};

window.startDeposit = () => {
  resetForm();
  const f = cubbies.find(c => !c.occupied);
  state.activeCubby = f ? f.id : 1;
  window.goToScreen("03-deposit-details");
};

window.startWithdraw = () => {
  const o = cubbies.find(c => c.occupied);
  state.activeCubby = o ? o.id : 1;
  window.goToScreen("11-withdraw-scan-rfid");
};

window.submitDepositDetails = () => {
  window.goToScreen("04-deposit-verifying");
};

window.completeDeposit = () => {
  cubbies = cubbies.map(c => c.id === state.activeCubby ? { ...c, occupied: true, visitor: { ...state.form } } : c);
  localStorage.setItem("kiosk_cubbies", JSON.stringify(cubbies));
  window.goToScreen("10-deposit-complete");
};

window.completeWithdraw = () => {
  cubbies = cubbies.map(c => c.id === state.activeCubby ? { ...c, occupied: false, visitor: null } : c);
  localStorage.setItem("kiosk_cubbies", JSON.stringify(cubbies));
  window.goToScreen("18-withdraw-complete");
};

// ==========================================================
// Keyboard Navigation & Shortcuts
// ==========================================================
window.addEventListener("keydown", (e) => {
  const focusables = getFocusableElements();

  if (state.currentScreen === "02-select-mode") {
    if (e.key === "1") {
      window.startDeposit();
      e.preventDefault();
      return;
    } else if (e.key === "2") {
      window.startWithdraw();
      e.preventDefault();
      return;
    }
  }

  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    if (focusables.length > 0) {
      currentFocusIndex = (currentFocusIndex + 1) % focusables.length;
      updateFocus();
      e.preventDefault();
    }
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    if (focusables.length > 0) {
      currentFocusIndex = (currentFocusIndex - 1 + focusables.length) % focusables.length;
      updateFocus();
      e.preventDefault();
    }
  } else if (e.key === "Enter") {
    const activeEl = focusables[currentFocusIndex];
    if (activeEl) {
      activeEl.click();
      e.preventDefault();
    }
  } else if (e.key === "Escape" || e.key === "Backspace") {
    const cancelBtn = document.querySelector("#cancelBtn, #btnBack, .link-btn");
    if (cancelBtn && document.activeElement.tagName !== "INPUT") {
      cancelBtn.click();
      e.preventDefault();
    }
  }
});

renderScreen();