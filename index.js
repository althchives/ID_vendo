import { backend } from "./kiosk-backend.js";
import { SCREENS } from "./screens.js";
import { renderIdle } from "./idle.js";
import { renderSelectMode } from "./select_mode.js";
import { renderDepositDetails } from "./deposit.js";

const state = {
  currentScreen: "01-idle",
  activeCubby: 1,
  form: {
    fullName: "Seth Denso",
    visitorType: "Student",
    office: "Registrar",
    contact: "09171234567"
  }
};

// Poll the Python Flask backend every 500ms to check for ultrasonic motion
setInterval(async () => {
    try {
        const response = await fetch('http://172.20.10.11:5000/check-motion');
        const data = await response.json();
        
        if (data.wake) {
            console.log("Motion detected from sensor! Changing UI screen...");
            
            // TODO: Replace these element IDs with your actual screen IDs in index.html
            // For example, hiding the idle screen and showing the main selection screen:
            const idleScreen = document.getElementById('idle-screen');
            const mainScreen = document.getElementById('main-screen');
            
            if (idleScreen && mainScreen) {
                idleScreen.classList.add('hidden');
                mainScreen.classList.remove('hidden');
            }
        }
    } catch (error) {
        // Silently catch network errors if Python script isn't running yet
    }
}, 500);

function renderCubbyGrid(highlightId = null, clickableMode = null) {
  return `
    <div class="cubby-grid">
      ${backend.cubbies
        .map((c) => {
          const isHighlighted = highlightId === c.id;
          const cls = ["cubby-pill", c.occupied ? "occupied" : "", isHighlighted ? "highlighted" : ""].join(" ");
          const subText = c.occupied ? (c.visitor?.fullName || "Occupied") : "Available";
          const clickAttr = clickableMode ? `onclick="window.handleCubbyClick(${c.id})"` : "";
          return `
            <div class="${cls}" ${clickAttr}>
              <span>Cubby #${c.id}</span>
              <span class="cubby-sub">${subText}</span>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderScreen() {
  const card = document.getElementById("kioskCard");
  const badge = document.getElementById("stateBadge");
  const screenMeta = SCREENS.find((s) => s.id === state.currentScreen);
  badge.textContent = state.currentScreen === "00-all-screens" ? "All 18 Screens" : (screenMeta?.badge || "Idle");

  const freeCount = backend.cubbies.filter((c) => !c.occupied).length;

  switch (state.currentScreen) {
    case "00-all-screens":
      card.innerHTML = `
        <div style="width:100%;">
          <h2 class="screen-title" style="font-size:28px; margin-bottom:6px;">00 · All 18 Kiosk Screens</h2>
          <p class="subtitle" style="font-size:16px; margin-bottom:18px;">Click any screen card below to preview its responsive 1280×720 landscape layout.</p>
          <div class="all-screens-grid">
            ${SCREENS.map((s) => `
              <div class="mini-screen-card" onclick="window.goToScreen('${s.id}')">
                <div class="mini-num">${s.num} · ${s.badge}</div>
                <div class="mini-name">${s.label}</div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
      break;

    case "01-idle":
      renderIdle(card, window.goToScreen);
      break;

    case "02-select-mode":
      renderSelectMode(card, window.goToScreen, window.startDeposit, window.startWithdraw, renderCubbyGrid, freeCount);
      break;

    case "03-deposit-details":
      renderDepositDetails(card, state, window.submitDepositDetails, window.goToScreen);
      break;

    case "04-deposit-verifying":
      card.innerHTML = `
        <div class="center-stage">
          <div class="spinner-ring"></div>
          <h2 class="screen-title">Checking availability...</h2>
          <p class="subtitle">Assigning an open cubby and preparing your visitor pass.</p>
          <button class="btn-secondary" onclick="window.goToScreen('05-deposit-scan-rfid')">Continue to RFID Scan →</button>
        </div>
      `;
      break;

    case "05-deposit-scan-rfid":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-scan">🪪</div>
          <h2 class="screen-title">Tap your RFID Visitor Pass</h2>
          <p class="subtitle">Hold the issued visitor card near the scanner below to unlock <strong>Cubby #${state.activeCubby}</strong>.</p>
          <button class="btn-primary" onclick="window.goToScreen('06-deposit-cubby-open')">Simulate RFID Tap</button>
          <button class="link-btn" onclick="window.goToScreen('02-select-mode')">Cancel</button>
        </div>
      `;
      break;

    case "06-deposit-cubby-open":
      card.innerHTML = `
        <div class="split-stage">
          <div class="split-left">
            <h2 class="screen-title">Cubby #${state.activeCubby} is open</h2>
            <p class="subtitle" style="margin-bottom:14px;">Place your personal ID inside the lit slot.</p>
            <ul class="checklist">
              <li><span class="check-badge done">✓</span> Cubby #${state.activeCubby} unlocked</li>
              <li><span class="check-badge">2</span> Place your valid ID flat on the tray</li>
              <li><span class="check-badge">3</span> Close the cubby door firmly</li>
            </ul>
            <div class="btn-row" style="justify-content:flex-start;">
              <button class="btn-primary" style="min-width:240px;" onclick="window.goToScreen('07-deposit-close-door')">ID Placed</button>
              <button class="btn-secondary" onclick="window.goToScreen('09-deposit-no-id-warning')">Test No ID</button>
            </div>
          </div>
          <div class="split-right">
            ${renderCubbyGrid(state.activeCubby)}
            <div class="cubby-status-text">Depositing for <strong>${state.form.fullName}</strong></div>
          </div>
        </div>
      `;
      break;

    case "07-deposit-close-door":
      card.innerHTML = `
        <div class="split-stage">
          <div class="split-left">
            <h2 class="screen-title">Close Cubby #${state.activeCubby}</h2>
            <p class="subtitle" style="margin-bottom:14px;">ID detected inside. Push the door until it clicks.</p>
            <ul class="checklist">
              <li><span class="check-badge done">✓</span> Cubby #${state.activeCubby} unlocked</li>
              <li><span class="check-badge done">✓</span> ID card detected on sensor</li>
              <li><span class="check-badge">3</span> Close door to lock &amp; finish</li>
            </ul>
            <div class="btn-row" style="justify-content:flex-start;">
              <button class="btn-primary" style="min-width:240px;" onclick="window.completeDeposit()">Close &amp; Lock Door</button>
              <button class="btn-secondary" onclick="window.goToScreen('08-deposit-door-warning')">Test Door Open</button>
            </div>
          </div>
          <div class="split-right">
            ${renderCubbyGrid(state.activeCubby)}
            <div class="cubby-status-text">Waiting for door latch...</div>
          </div>
        </div>
      `;
      break;

    case "08-deposit-door-warning":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-warn">⚠️</div>
          <h2 class="screen-title">Cubby #${state.activeCubby} door is still open</h2>
          <p class="subtitle">Please push the door shut so your ID stays secure before leaving.</p>
          <button class="btn-primary" onclick="window.completeDeposit()">Door Closed Now</button>
        </div>
      `;
      break;

    case "09-deposit-no-id-warning":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-danger">🪪</div>
          <h2 class="screen-title">No ID detected in Cubby #${state.activeCubby}</h2>
          <p class="subtitle">The tray sensor did not detect an ID card. Place your ID inside before closing.</p>
          <div class="btn-row">
            <button class="btn-primary" style="min-width:240px;" onclick="window.goToScreen('06-deposit-cubby-open')">Back to Cubby</button>
            <button class="btn-secondary" onclick="window.goToScreen('02-select-mode')">Cancel Deposit</button>
          </div>
        </div>
      `;
      break;

    case "10-deposit-complete":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-success">✅</div>
          <h2 class="screen-title">Deposit complete!</h2>
          <p class="subtitle">Your ID is safely stored in <strong>Cubby #${state.activeCubby}</strong>.<br/>Keep your RFID pass to retrieve it later.</p>
          <button class="btn-primary" onclick="window.goToScreen('01-idle')">Done</button>
        </div>
      `;
      break;

    case "11-withdraw-scan-rfid":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-scan">📡</div>
          <h2 class="screen-title">Scan your RFID Visitor Pass</h2>
          <p class="subtitle">Tap your visitor card on the reader to open your assigned cubby.</p>
          <div class="btn-row">
            <button class="btn-primary" style="min-width:250px;" onclick="window.goToScreen('12-withdraw-verifying')">Simulate Valid Scan</button>
            <button class="btn-secondary" onclick="window.goToScreen('13-withdraw-invalid-rfid')">Test Invalid Card</button>
          </div>
          <button class="link-btn" onclick="window.goToScreen('02-select-mode')">Back</button>
        </div>
      `;
      break;

    case "12-withdraw-verifying":
      card.innerHTML = `
        <div class="center-stage">
          <div class="spinner-ring"></div>
          <h2 class="screen-title">Verifying RFID pass...</h2>
          <p class="subtitle">Looking up your cubby assignment in Firebase...</p>
          <button class="btn-secondary" onclick="window.goToScreen('14-withdraw-cubby-open')">Open Cubby #${state.activeCubby} →</button>
        </div>
      `;
      break;

    case "13-withdraw-invalid-rfid":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-danger">❌</div>
          <h2 class="screen-title">Unrecognized RFID card</h2>
          <p class="subtitle">This card is not linked to an active cubby. Please try again or ask the front desk.</p>
          <div class="btn-row">
            <button class="btn-primary" style="min-width:240px;" onclick="window.goToScreen('11-withdraw-scan-rfid')">Try Again</button>
            <button class="btn-secondary" onclick="window.goToScreen('02-select-mode')">Main Menu</button>
          </div>
        </div>
      `;
      break;

    case "14-withdraw-cubby-open":
      card.innerHTML = `
        <div class="split-stage">
          <div class="split-left">
            <h2 class="screen-title">Take your ID from Cubby #${state.activeCubby}</h2>
            <p class="subtitle" style="margin-bottom:14px;">Retrieve your ID and drop the visitor RFID pass in the return slot.</p>
            <ul class="checklist">
              <li><span class="check-badge done">✓</span> Cubby #${state.activeCubby} unlocked</li>
              <li><span class="check-badge">2</span> Remove your personal ID from the tray</li>
              <li><span class="check-badge">3</span> Close the cubby door</li>
            </ul>
            <div class="btn-row" style="justify-content:flex-start;">
              <button class="btn-primary" style="min-width:240px;" onclick="window.goToScreen('15-withdraw-close-door')">ID Removed</button>
              <button class="btn-secondary" onclick="window.goToScreen('16-withdraw-id-still-inside')">Test ID Left Inside</button>
            </div>
          </div>
          <div class="split-right">
            ${renderCubbyGrid(state.activeCubby)}
            <div class="cubby-status-text">Cubby #${state.activeCubby} is open</div>
          </div>
        </div>
      `;
      break;

    case "15-withdraw-close-door":
      card.innerHTML = `
        <div class="split-stage">
          <div class="split-left">
            <h2 class="screen-title">Close Cubby #${state.activeCubby}</h2>
            <p class="subtitle" style="margin-bottom:14px;">Tray is empty. Close the door to complete checkout.</p>
            <ul class="checklist">
              <li><span class="check-badge done">✓</span> Cubby #${state.activeCubby} unlocked</li>
              <li><span class="check-badge done">✓</span> Personal ID retrieved</li>
              <li><span class="check-badge">3</span> Close the cubby door</li>
            </ul>
            <div class="btn-row" style="justify-content:flex-start;">
              <button class="btn-primary" style="min-width:240px;" onclick="window.completeWithdraw()">Close Door &amp; Finish</button>
              <button class="btn-secondary" onclick="window.goToScreen('17-withdraw-door-warning')">Test Door Open</button>
            </div>
          </div>
          <div class="split-right">
            ${renderCubbyGrid(state.activeCubby)}
            <div class="cubby-status-text">Waiting for door latch...</div>
          </div>
        </div>
      `;
      break;

    case "16-withdraw-id-still-inside":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-warn">⚠️</div>
          <h2 class="screen-title">Your ID is still inside Cubby #${state.activeCubby}</h2>
          <p class="subtitle">Please take your ID card from the tray before closing the cubby door.</p>
          <button class="btn-primary" onclick="window.goToScreen('14-withdraw-cubby-open')">Back to Cubby #${state.activeCubby}</button>
        </div>
      `;
      break;

    case "17-withdraw-door-warning":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-warn">🚪</div>
          <h2 class="screen-title">Please close Cubby #${state.activeCubby}</h2>
          <p class="subtitle">The cubby door is still ajar. Push it shut to complete your withdrawal.</p>
          <button class="btn-primary" onclick="window.completeWithdraw()">Door Closed Now</button>
        </div>
      `;
      break;

    case "18-withdraw-complete":
      card.innerHTML = `
        <div class="center-stage">
          <div class="status-icon-circle icon-success">🎉</div>
          <h2 class="screen-title">Thank you for visiting!</h2>
          <p class="subtitle"><strong>Cubby #${state.activeCubby}</strong> is now free and synced to Firebase.<br/>Have a great day, ${state.form.fullName}.</p>
          <button class="btn-primary" onclick="window.goToScreen('01-idle')">Finish</button>
        </div>
      `;
      break;
  }

  renderBottomNav();
}

function renderBottomNav() {
  const nav = document.getElementById("screenNav");
  nav.innerHTML = SCREENS.map(
    (s) => `
      <button class="nav-chip ${state.currentScreen === s.id ? "active" : ""}" onclick="window.goToScreen('${s.id}')">
        ${s.num} · ${s.label}
      </button>
    `
  ).join("");
}

// Global window actions for DOM event bindings
window.goToScreen = (screenId) => {
  state.currentScreen = screenId;
  renderScreen();
};

window.startDeposit = () => {
  const openCubby = backend.cubbies.find((c) => !c.occupied);
  state.activeCubby = openCubby ? openCubby.id : 1;
  window.goToScreen("03-deposit-details");
};

window.startWithdraw = () => {
  const usedCubby = backend.cubbies.find((c) => c.occupied);
  state.activeCubby = usedCubby ? usedCubby.id : 1;
  window.goToScreen("11-withdraw-scan-rfid");
};

window.handleCubbyClick = (cubbyId) => {
  state.activeCubby = cubbyId;
  const cubby = backend.cubbies.find((c) => c.id === cubbyId);
  if (cubby && cubby.occupied) {
    window.goToScreen("11-withdraw-scan-rfid");
  } else {
    window.goToScreen("03-deposit-details");
  }
};

window.submitDepositDetails = () => {
  state.form = {
    fullName: document.getElementById("inpName")?.value.trim() || "Seth Denso",
    visitorType: document.getElementById("inpType")?.value || "Student",
    office: document.getElementById("inpOffice")?.value.trim() || "Registrar",
    contact: document.getElementById("inpContact")?.value.trim() || "09171234567"
  };
  window.goToScreen("04-deposit-verifying");
  setTimeout(() => {
    if (state.currentScreen === "04-deposit-verifying") {
      window.goToScreen("05-deposit-scan-rfid");
    }
  }, 1100);
};

window.completeDeposit = async () => {
  await backend.depositToCubby(state.activeCubby, { ...state.form });
  window.goToScreen("10-deposit-complete");
};

window.completeWithdraw = async () => {
  await backend.withdrawFromCubby(state.activeCubby);
  window.goToScreen("18-withdraw-complete");
};

window.resetCubbies = async () => {
  await backend.resetAll();
  renderScreen();
};

// Initialize backend listener & boot screen
backend.init(() => renderScreen());
renderScreen();