const KEY = "site504.refreshCount";
const FRAME2_CHANCE = 0.20; // 20% chance after each real page reload

const refreshCountEl = document.getElementById("refreshCount");
const onlineCountEls = [
  document.getElementById("onlineCount"),
  document.getElementById("onlineCountOverlay")
].filter(Boolean);
const refreshButton = document.getElementById("refreshButton");
const chatToggle = document.getElementById("chatToggle");
const chatClose = document.getElementById("chatClose");
const chatPanel = document.getElementById("chatPanel");
const messages = document.getElementById("messages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const frame1 = document.getElementById("frame1");
const frame2 = document.getElementById("frame2");

function getRefreshCount() {
  const value = Number.parseInt(localStorage.getItem(KEY) || "0", 10);
  return Number.isFinite(value) ? value : 0;
}

// Count ONLY real reloads. The first visit is not an update.
const navigation = performance.getEntriesByType("navigation")[0];
const isReload = navigation?.type === "reload";
let count = getRefreshCount();
if (isReload) {
  count += 1;
  localStorage.setItem(KEY, String(count));
}
refreshCountEl.textContent = count;

// First visit = Frame 1. Every actual reload has a 30% chance to land on Frame 2.
const showFrame2 = isReload && Math.random() < FRAME2_CHANCE;
frame1.classList.toggle("active", !showFrame2);
frame2.classList.toggle("active", showFrame2);
frame1.setAttribute("aria-hidden", String(showFrame2));
frame2.setAttribute("aria-hidden", String(!showFrame2));

refreshButton.addEventListener("click", () => {
  // Do not increment here. The reload itself is counted exactly once above.
  window.location.reload();
});

function addMessage(text) {
  const item = document.createElement("div");
  item.className = "message";
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

// Chat is opened by hover, not by click. CSS handles the slide animation.
// Keep aria state synchronized for keyboard users as well.
chatToggle.addEventListener("mouseenter", () => {
  chatToggle.setAttribute("aria-expanded", "true");
  chatPanel.setAttribute("aria-hidden", "false");
});
chatToggle.addEventListener("mouseleave", () => {
  // The panel remains visible while the pointer is over the whole chat wrapper.
});
chatPanel.addEventListener("mouseenter", () => {
  chatToggle.setAttribute("aria-expanded", "true");
  chatPanel.setAttribute("aria-hidden", "false");
});
chatPanel.addEventListener("mouseleave", () => {
  chatToggle.setAttribute("aria-expanded", "false");
  chatPanel.setAttribute("aria-hidden", "true");
});
chatClose.addEventListener("click", (event) => event.preventDefault());


// === REBUILT EYE MOTION ===
// No rotation is used anywhere for the eye artwork.
// Scrolling only gives the eyes a small vertical bounce.
const frame2Motion = document.getElementById("frame2");
const eyes = frame2Motion ? frame2Motion.querySelectorAll(".f2-eye") : [];
let eyeOffset = 0;
let eyeVelocity = 0;
let previousScrollY = window.scrollY;

function handleEyeScroll() {
  const delta = window.scrollY - previousScrollY;
  previousScrollY = window.scrollY;
  if (!eyes.length || delta === 0) return;
  eyeVelocity += delta * 0.11;
  eyeVelocity = Math.max(-4, Math.min(4, eyeVelocity));
}

function animateEyeBounce() {
  eyeVelocity *= 0.82;
  eyeOffset += eyeVelocity;
  eyeOffset *= 0.90;
  eyeOffset = Math.max(-10, Math.min(10, eyeOffset));
  for (const eye of eyes) {
    if (!eye.dataset.baseTop) {
      eye.dataset.baseTop = getComputedStyle(eye).top;
    }
    eye.style.top = `calc(${eye.dataset.baseTop} + ${eyeOffset.toFixed(2)}px)`;
    eye.style.transform = "none";
    eye.style.rotate = "0deg";
  }
  requestAnimationFrame(animateEyeBounce);
}

window.addEventListener("scroll", handleEyeScroll, { passive: true });
requestAnimationFrame(animateEyeBounce);

const protocol = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${protocol}//${location.host}`);

ws.addEventListener("open", () => addMessage("соединение с чатом установлено"));

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "presence") {
    for (const el of onlineCountEls) el.textContent = msg.count;
  }
  if (msg.type === "chat") addMessage(msg.text);
});

ws.addEventListener("close", () => {
  for (const el of onlineCountEls) el.textContent = "0";
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "chat", text }));
  chatInput.value = "";
});
