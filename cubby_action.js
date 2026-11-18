export function renderCubbyAction(cardEl, title, subtitle, steps, buttonText, onButtonClick, renderCubbyGrid, activeCubby) {
    cardEl.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: stretch; width: 100%; gap: 36px;">
            
            <!-- Left Side: Actions & Steps -->
            <div style="flex: 1.1; display: flex; flex-direction: column; text-align: left; justify-content: center;">
                <h2 class="screen-title" style="font-size: 34px; font-weight: 800; margin-bottom: 8px; color: var(--text-primary);">${title}</h2>
                <p class="subtitle" style="font-size: 15px; color: var(--text-secondary); margin-bottom: 24px;">${subtitle}</p>
                
                <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; width: 100%;">
                    ${steps.map(s => `
                        <div style="display: flex; align-items: center; gap: 14px; background: var(--pill-bg); border: 1.5px solid var(--pill-border); border-radius: 14px; padding: 14px 18px;">
                            <div style="width: 28px; height: 28px; border-radius: 50%; background: ${s.done ? 'var(--success-bg)' : 'var(--accent-purple)'}; color: ${s.done ? 'var(--success-text)' : '#fff'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px;">
                                ${s.done ? '✓' : (s.step || '')}
                            </div>
                            <span style="font-size: 15px; font-weight: 600; color: var(--text-primary);">${s.text}</span>
                        </div>
                    `).join('')}
                </div>

                <button class="btn-primary" id="actionBtn" style="width: 100%;">${buttonText}</button>
            </div>

            <!-- Right Side: Larger 6 Cubbies Availability Grid Box -->
            <div style="flex: 1.2; background: rgba(255,255,255,0.75); border: 1.5px solid var(--pill-border); border-radius: 22px; padding: 28px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(124, 58, 237, 0.04);">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 18px; color: var(--text-primary);">Cubby Status</h3>
                <div style="width: 100%;">
                    ${renderCubbyGrid(activeCubby, false)}
                </div>
            </div>

        </div>
    `;

    document.getElementById("actionBtn").onclick = onButtonClick;
}