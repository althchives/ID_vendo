export function renderScanRfid(cardEl, title, subtitle, buttonText, onButtonClick, onCancelClick) {
    cardEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
            
            <!-- RFID Scan Icon -->
            <div style="width: 88px; height: 88px; border-radius: 50%; background: var(--pill-bg); border: 1.5px solid var(--pill-border); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.06);">
                <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="2" y1="10" x2="22" y2="10"></line>
                    <path d="M6 15h2"></path>
                    <path d="M10 15h4"></path>
                </svg>
            </div>

            <!-- Title & Subtitle -->
            <h2 class="screen-title" style="font-size: 38px; font-weight: 800; margin-bottom: 10px; color: var(--text-primary);">${title}</h2>
            <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 28px; max-width: 500px;">${subtitle}</p>

            <!-- Evenly Spaced Action Buttons Container -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%;">
                <button class="btn-primary" id="scanBtn">${buttonText}</button>
                ${onCancelClick ? `<button class="link-btn" id="cancelBtn">Cancel</button>` : ''}
            </div>

        </div>
    `;

    document.getElementById("scanBtn").onclick = onButtonClick;
    if (onCancelClick && document.getElementById("cancelBtn")) {
        document.getElementById("cancelBtn").onclick = onCancelClick;
    }
}