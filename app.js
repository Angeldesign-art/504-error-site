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

// First visit = Frame 1. Every actual reload has a 20% chance to land on Frame 2.
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


// Scroll-driven Figma variants. Two tracks advance in opposite sequences.
const eyes = [...frame2.querySelectorAll(".f2-eye")];
const firstLines = [...document.querySelectorAll("#narrativeFirst .narrative-line")];
const secondLines = [...document.querySelectorAll("#narrativeSecond .narrative-line")];
let motionScroll = window.scrollY;
let scrollTarget = window.scrollY;
let motionPending = false;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
function setNarrative(lines, phase, inverted) {
  const idx = Math.min(2, Math.floor(phase * 3));
  lines.forEach((line, i) => {
    const active = i === idx;
    line.classList.toggle("is-active", active);
    line.style.transform = `translate3d(0,${active ? 0 : (i < idx ? -36 : 36)}px,0)`;
    line.style.opacity = active ? "1" : "0";
  });
}
function updateMotion() {
  motionPending = false;
  motionScroll += (scrollTarget - motionScroll) * (reducedMotion.matches ? 1 : .16);
  if (showFrame2) {
    const top = frame2.getBoundingClientRect().top + window.scrollY;
    const y = Math.max(0, motionScroll - top);
    eyes.forEach((eye, i) => {
      eye.style.transform = `translate3d(0,${(y * (i ? -.095 : .16)).toFixed(2)}px,0)`;
    });
    const firstProgress = Math.max(0, Math.min(.9999, (y - 320) / 900));
    const secondProgress = Math.max(0, Math.min(.9999, (y - 670) / 850));
    setNarrative(firstLines, firstProgress, false);
    setNarrative(secondLines, secondProgress, true);
  }
  if (Math.abs(scrollTarget - motionScroll) > .25) scheduleMotion();
}
function scheduleMotion() {
  if (!motionPending) { motionPending = true; requestAnimationFrame(updateMotion); }
}
window.addEventListener("scroll", () => { scrollTarget = window.scrollY; scheduleMotion(); }, {passive:true});
window.addEventListener("resize", scheduleMotion);
scheduleMotion();

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
