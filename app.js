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


// Scroll interaction is confined to the existing Figma component variants.
const leftVariants = [
 "Создатель изменил ресурс — и изменил поведение тысяч людей.",
 "Люди начали обновлять страницу с надеждой на изменение, жаловаться на ошибку.",
 "Только благодаря коллективным следам создатель узнал об ошибке и может исправить."
];
const rightVariants = [
 "Ничего не изменилось.<br>Или тебе только кажется?<br>Попробуй ещё раз.",
 "Система не требует от тебя ничего.<br>Она просто оставляет возможность повторить действие.",
 "Ты можешь уйти.<br>Можешь закрыть вкладку.<br>Можешь попробовать ещё раз."
];
const leftText = document.querySelector("#variantsLeft .variant-text");
const rightText = document.querySelector("#variantsRight .variant-text");
const eyes = [...document.querySelectorAll(".f2-eye")];
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let lastIndex = -1;
function applyVariant(node, value) {
 if (node.innerHTML === value) return;
 if (reducedMotion.matches) {node.innerHTML=value;return;}
 node.classList.add("changing");
 window.setTimeout(()=>{node.innerHTML=value;node.classList.remove("changing");},220);
}
let pending=false;
function updateScroll() {
 pending=false;
 if (!showFrame2) return;
 const scroll=Math.max(0,window.scrollY);
 // Different vertical speeds, never rotation; use local page scroll only.
 eyes.forEach((eye,i)=>{eye.style.transform=`translate3d(0,${(scroll*(i===0?-.12:.075)).toFixed(1)}px,0)`;});
 const index=Math.min(2,Math.floor(scroll/310));
 if(index!==lastIndex) {
  lastIndex=index;
  applyVariant(leftText,leftVariants[index]);
  applyVariant(rightText,rightVariants[index]);
 }
}
function scheduleScroll(){if(!pending){pending=true;requestAnimationFrame(updateScroll);}}
window.addEventListener("scroll",scheduleScroll,{passive:true});
window.addEventListener("resize",scheduleScroll);
scheduleScroll();

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
