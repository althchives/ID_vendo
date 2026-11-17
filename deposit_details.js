export function renderDepositDetails(cardEl, state, onSubmit, onBackClick) {
  cardEl.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
      <h2 class="screen-title" style="font-size: 38px; font-weight: 800; margin-bottom: 10px;">Your details</h2>
      <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 8px; max-width: 500px;">We need a few details before we give you an RFID ID.</p>
      <p id="errorMsg" style="font-size: 14px; font-weight: 600; color: #e11d48; margin-bottom: 20px; min-height: 20px;"></p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; max-width: 600px; margin-bottom: 24px;">
        <input type="text" class="kiosk-input" id="inpName" placeholder="Full Name" value="${state.form.fullName || ''}" style="padding: 14px 18px; border-radius: 12px; border: 1.5px solid var(--pill-border); font-size: 16px; background: var(--pill-bg); color: var(--text-primary); outline: none;" />
        
        <input type="text" class="kiosk-input" id="inpAffiliation" placeholder="Affiliation (e.g. Visitor, Student)" value="${state.form.affiliation || ''}" style="padding: 14px 18px; border-radius: 12px; border: 1.5px solid var(--pill-border); font-size: 16px; background: var(--pill-bg); color: var(--text-primary); outline: none;" />
        
        <input type="text" class="kiosk-input" id="inpPurpose" placeholder="Purpose of Visit" value="${state.form.purpose || ''}" style="padding: 14px 18px; border-radius: 12px; border: 1.5px solid var(--pill-border); font-size: 16px; background: var(--pill-bg); color: var(--text-primary); outline: none;" />
        
        <input type="tel" inputmode="numeric" maxlength="11" class="kiosk-input" id="inpContact" placeholder="Mobile Number" value="${state.form.contact || ''}" style="padding: 14px 18px; border-radius: 12px; border: 1.5px solid var(--pill-border); font-size: 16px; background: var(--pill-bg); color: var(--text-primary); outline: none;" />
      </div>

      <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%;">
        <button class="btn-primary" id="btnContinue">Continue</button>
        <button class="link-btn" id="btnBack">Back</button>
      </div>
    </div>
  `;

  const inpName = document.getElementById("inpName");
  const inpAffiliation = document.getElementById("inpAffiliation");
  const inpPurpose = document.getElementById("inpPurpose");
  const inpContact = document.getElementById("inpContact");
  const errorMsg = document.getElementById("errorMsg");

  // Prevent numbers in Full Name, Affiliation, and Purpose of Visit
  [inpName, inpAffiliation, inpPurpose].forEach((inputEl) => {
    inputEl.addEventListener("input", () => {
      const cleaned = inputEl.value.replace(/[0-9]/g, "");
      if (inputEl.value !== cleaned) {
        inputEl.value = cleaned;
        errorMsg.textContent = "Numbers are not allowed in text fields.";
      } else {
        errorMsg.textContent = "";
      }
    });
  });

  // Prevent non-numeric characters in Mobile Number
  inpContact.addEventListener("input", () => {
    const cleaned = inpContact.value.replace(/[^0-9]/g, "");
    if (inpContact.value !== cleaned) {
      inpContact.value = cleaned;
      errorMsg.textContent = "Mobile number must contain digits only.";
    } else {
      errorMsg.textContent = "";
    }
  });

  document.getElementById("btnContinue").onclick = () => {
    const name = inpName.value.trim();
    const affiliation = inpAffiliation.value.trim();
    const purpose = inpPurpose.value.trim();
    const contact = inpContact.value.trim();

    if (!name || !affiliation || !purpose || !contact) {
      errorMsg.textContent = "Some input fields are missing. Please fill out all fields.";
      return;
    }

    if (/[0-9]/.test(name) || /[0-9]/.test(affiliation) || /[0-9]/.test(purpose)) {
      errorMsg.textContent = "Full Name, Affiliation, and Purpose of Visit cannot contain numbers.";
      return;
    }

    if (!/^[0-9]+$/.test(contact)) {
      errorMsg.textContent = "Mobile Number must contain numbers only.";
      return;
    }

    state.form.fullName = name;
    state.form.affiliation = affiliation;
    state.form.purpose = purpose;
    state.form.contact = contact;
    onSubmit();
  };

  document.getElementById("btnBack").onclick = onBackClick;
}