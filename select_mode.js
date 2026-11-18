export function renderSelectMode(cardEl, onDeposit, onWithdraw, renderCubbyGrid, freeCount, onCancel) {
    cardEl.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; width: 100%;">
            <h2 class="screen-title" style="font-size: 38px; font-weight: 800; margin-bottom: 10px;">Select mode</h2>
            <p class="subtitle" style="font-size: 16px; color: var(--text-secondary); margin-bottom: 28px;">What would you like to do?</p>
            
            <div style="display: flex; gap: 20px; justify-content: center; width: 100%; margin-bottom: 28px;">
                <!-- Deposit Option -->
                <div class="kiosk-select-card" id="cardDeposit" tabindex="0" style="flex: 1; max-width: 240px; background: var(--pill-bg); border: 1.5px solid var(--pill-border); border-radius: 20px; padding: 28px 20px; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
                    <div style="font-size: 36px; margin-bottom: 12px;">📥</div>
                    <span style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Deposit ID</span>
                    <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Press 1 for Deposit</span>
                </div>

                <!-- Withdraw Option -->
                <div class="kiosk-select-card" id="cardWithdraw" tabindex="0" style="flex: 1; max-width: 240px; background: var(--pill-bg); border: 1.5px solid var(--pill-border); border-radius: 20px; padding: 28px 20px; cursor: pointer; display: flex; flex-direction: column; align-items: center;">
                    <div style="font-size: 36px; margin-bottom: 12px;">📤</div>
                    <span style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Withdraw ID</span>
                    <span style="font-size: 13px; font-weight: 600; color: var(--text-secondary);">Press 2 for Withdraw</span>
                </div>
            </div>

            <button class="link-btn" id="btnCancel" tabindex="0">Cancel</button>
        </div>
    `;

    document.getElementById("cardDeposit").onclick = onDeposit;
    document.getElementById("cardWithdraw").onclick = onWithdraw;
    document.getElementById("btnCancel").onclick = () => onCancel("01-idle");
}