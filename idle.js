export function renderIdle(cardEl, goToScreen) {
  cardEl.innerHTML = `
    <div class="idle-stage">
      <div class="orb-wrapper" id="idleOrb"><div class="orb-core"></div></div>
      <h1 class="idle-title">Welcome</h1>
      <p class="idle-subtitle">Step closer to begin.<br/>Waiting for motion...</p>
    </div>
  `;
  document.getElementById("idleOrb").onclick = () => goToScreen("02-select-mode");
}