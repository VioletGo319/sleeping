const storageKey = "sleep-manager-events-v1";
const dayMs = 24 * 60 * 60 * 1000;

const state = {
  events: loadEvents(),
  range: "week",
};

const els = {
  todayChip: document.querySelector("#todayChip"),
  adviceText: document.querySelector("#adviceText"),
  wakeButton: document.querySelector("#wakeButton"),
  sleepButton: document.querySelector("#sleepButton"),
  sleeplessButton: document.querySelector("#sleeplessButton"),
  todaySleep: document.querySelector("#todaySleep"),
  wakeCount: document.querySelector("#wakeCount"),
  fragmentation: document.querySelector("#fragmentation"),
  timeline: document.querySelector("#timeline"),
  clearTodayButton: document.querySelector("#clearTodayButton"),
  quickTextForm: document.querySelector("#quickTextForm"),
  quickText: document.querySelector("#quickText"),
  manualForm: document.querySelector("#manualForm"),
  manualType: document.querySelector("#manualType"),
  startTime: document.querySelector("#startTime"),
  endTime: document.querySelector("#endTime"),
  chart: document.querySelector("#sleepChart"),
  rangeButtons: document.querySelectorAll(".range-toggle button"),
  logList: document.querySelector("#logList"),
};

function loadEvents() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]")
      .filter((event) => event.at && event.type)
      .sort((a, b) => new Date(a.at) - new Date(b.at));
  } catch {
    return [];
  }
}

function saveEvents() {
  localStorage.setItem(storageKey, JSON.stringify(state.events));
}

function addEvent(type, at = new Date(), note = "") {
  state.events.push({
    id: crypto.randomUUID(),
    type,
    at: at.toISOString(),
    note,
  });
  state.events.sort((a, b) => new Date(a.at) - new Date(b.at));
  saveEvents();
  render();
}

function addRange(type, start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate >= endDate) {
    alert("请选择有效的开始和结束时间。");
    return;
  }

  addEvent(type, startDate);
  addEvent(type === "sleep" ? "awake" : "sleep", endDate);
}

function addAwakeText(text) {
  const match = text.match(/(\d{1,2})(?::|点)?(\d{0,2})\s*(?:-|到|至|~|—)\s*(\d{1,2})(?::|点)?(\d{0,2})/);
  if (!match) {
    alert("我还没读懂这段时间。可以试试：2:10-2:40 醒着");
    return;
  }

  const [, startHour, startMinute = "0", endHour, endMinute = "0"] = match;
  const start = dayStart();
  start.setHours(Number(startHour), Number(startMinute || 0), 0, 0);
  const end = dayStart();
  end.setHours(Number(endHour), Number(endMinute || 0), 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);
  addRange("awake", start, end);
}

function lastEventIndexBefore(time) {
  for (let index = state.events.length - 1; index >= 0; index -= 1) {
    if (new Date(state.events[index].at) <= time) return index;
  }
  return -1;
}

function handleWake() {
  const now = new Date();
  const lastIndex = lastEventIndexBefore(now);
  const lastEvent = lastIndex >= 0 ? state.events[lastIndex] : null;
  if (lastEvent?.type === "sleep" && now - new Date(lastEvent.at) <= 45 * 60 * 1000) {
    markSleepless(now);
    return;
  }
  addEvent("awake", now);
}

function markSleepless(at = new Date()) {
  const now = new Date(at);
  const lastIndex = lastEventIndexBefore(now);
  if (lastIndex >= 0 && state.events[lastIndex].type === "sleep") {
    state.events.splice(lastIndex, 1);
  }
  state.events.push({
    id: crypto.randomUUID(),
    type: "awake",
    at: now.toISOString(),
    note: "没睡着，起来了",
  });
  state.events.sort((a, b) => new Date(a.at) - new Date(b.at));
  saveEvents();
  render();
}

function dayStart(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function statusAt(time) {
  let status = "awake";
  for (const event of state.events) {
    if (new Date(event.at) <= time) {
      status = event.type;
    } else {
      break;
    }
  }
  return status;
}

function segmentsForDay(date) {
  const start = dayStart(date);
  const end = new Date(start.getTime() + dayMs);
  const dayEvents = state.events
    .filter((event) => {
      const at = new Date(event.at);
      return at >= start && at < end;
    })
    .map((event) => ({ ...event, date: new Date(event.at) }));

  const points = [
    { type: statusAt(start), date: start },
    ...dayEvents,
    { type: null, date: end },
  ];

  return points.slice(0, -1).map((point, index) => ({
    type: point.type,
    start: point.date,
    end: points[index + 1].date,
  }));
}

function statsForDay(date) {
  const segments = segmentsForDay(date);
  const sleepMs = segments
    .filter((segment) => segment.type === "sleep")
    .reduce((sum, segment) => sum + (segment.end - segment.start), 0);
  const wakeEvents = state.events.filter((event) => {
    const at = new Date(event.at);
    const start = dayStart(date);
    return event.type === "awake" && at >= start && at < new Date(start.getTime() + dayMs);
  });
  const sleepBlocks = segments.filter((segment) => segment.type === "sleep" && segment.end > segment.start).length;

  return {
    sleepMs,
    wakeCount: wakeEvents.length,
    sleepBlocks,
    fragmentationScore: Math.max(0, wakeEvents.length - 1) + Math.max(0, sleepBlocks - 1),
  };
}

function formatHours(ms) {
  const hours = ms / 36e5;
  if (hours < 1) return `${Math.round(hours * 60)}分钟`;
  return `${hours.toFixed(hours >= 10 ? 0 : 1)}小时`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function adviceFromStats(stats) {
  const hours = stats.sleepMs / 36e5;
  if (state.events.length < 2) return "先用“我醒了”和“开始睡了”记录几个节点，趋势会比单次估算更有意义。";
  if (hours < 6) return "今天睡眠偏少。今晚可以把入睡提醒提前一些，并尽量减少临睡前的强光和长时间刷屏。";
  if (stats.fragmentationScore >= 4) return "睡眠比较零散。建议观察醒来是否集中在固定时段，晚间咖啡因、饮水量和室温都值得留意。";
  if (hours >= 7 && hours <= 9 && stats.fragmentationScore <= 2) return "今天的睡眠长度和连续性都不错。继续保持相近的入睡和起床节奏。";
  if (hours > 9.5) return "今天睡得比较久。如果醒来仍然疲惫，可以看看是否存在频繁短醒或作息漂移。";
  return "今天整体还可以。接下来重点看一周趋势，规律性通常比单天表现更有参考价值。";
}

function fragmentationLabel(score) {
  if (score <= 1) return "低";
  if (score <= 3) return "中";
  return "高";
}

function renderToday() {
  const today = new Date();
  const stats = statsForDay(today);
  els.todayChip.textContent = formatDate(today);
  els.todaySleep.textContent = formatHours(stats.sleepMs);
  els.wakeCount.textContent = stats.wakeCount;
  els.fragmentation.textContent = fragmentationLabel(stats.fragmentationScore);
  els.adviceText.textContent = adviceFromStats(stats);
}

function renderTimeline() {
  const todayStart = dayStart();
  els.timeline.innerHTML = "";
  for (const segment of segmentsForDay(new Date())) {
    const left = ((segment.start - todayStart) / dayMs) * 100;
    const width = ((segment.end - segment.start) / dayMs) * 100;
    const div = document.createElement("div");
    div.className = `timeline-segment ${segment.type}`;
    div.style.left = `${clamp(left, 0, 100)}%`;
    div.style.width = `${clamp(width, 0, 100)}%`;
    div.title = `${segment.type === "sleep" ? "睡眠" : "清醒"} ${formatTime(segment.start)} - ${formatTime(segment.end)}`;
    els.timeline.appendChild(div);
  }
}

function renderChart() {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const days = state.range === "week" ? 7 : 30;
  const width = canvas.width;
  const height = canvas.height;
  const pad = 48;
  const chartHeight = height - pad * 1.65;
  const chartWidth = width - pad * 1.35;
  const now = dayStart();
  const data = Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - index - 1) * dayMs);
    return {
      date,
      hours: statsForDay(date).sleepMs / 36e5,
    };
  });

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#14102e";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(187, 180, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#b9b4d8";
  ctx.font = "22px system-ui";
  for (let i = 0; i <= 4; i += 1) {
    const value = i * 3;
    const y = pad + chartHeight - (value / 12) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad / 2, y);
    ctx.stroke();
    ctx.fillText(`${value}h`, 8, y + 7);
  }

  const gap = days > 10 ? 7 : 18;
  const barWidth = Math.max(8, (chartWidth - gap * (days - 1)) / days);
  data.forEach((item, index) => {
    const barHeight = clamp(item.hours / 12, 0, 1) * chartHeight;
    const x = pad + index * (barWidth + gap);
    const y = pad + chartHeight - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, pad + chartHeight);
    gradient.addColorStop(0, "#b8f3ff");
    gradient.addColorStop(0.52, "#6f74ff");
    gradient.addColorStop(1, "#4430a7");
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, barWidth, barHeight, 6);
    ctx.fill();

    const shouldLabel = days === 7 || index % 5 === 0 || index === days - 1;
    if (shouldLabel) {
      ctx.save();
      ctx.translate(x + barWidth / 2, height - 24);
      ctx.rotate(days === 7 ? 0 : -0.7);
      ctx.fillStyle = "#b9b4d8";
      ctx.font = days === 7 ? "22px system-ui" : "18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${item.date.getMonth() + 1}/${item.date.getDate()}`, 0, 0);
      ctx.restore();
    }
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function renderLog() {
  els.logList.innerHTML = "";
  const recent = [...state.events].reverse().slice(0, 12);
  if (!recent.length) {
    els.logList.innerHTML = '<p class="empty-state">还没有记录。醒来或准备睡觉时点一下就行。</p>';
    return;
  }

  for (const event of recent) {
    const item = document.createElement("div");
    item.className = "log-item";
    item.innerHTML = `
      <div>
        <strong>${event.note || (event.type === "awake" ? "醒来" : "开始睡")}</strong>
        <span>${formatTime(new Date(event.at))}</span>
      </div>
      <button type="button" data-id="${event.id}">删除</button>
    `;
    els.logList.appendChild(item);
  }
}

function setManualDefaults() {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 60 * 1000);
  els.startTime.value = toInputValue(start);
  els.endTime.value = toInputValue(now);
}

function toInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function clearToday() {
  const start = dayStart();
  const end = new Date(start.getTime() + dayMs);
  state.events = state.events.filter((event) => {
    const at = new Date(event.at);
    return at < start || at >= end;
  });
  state.events.push({
    id: crypto.randomUUID(),
    type: "awake",
    at: start.toISOString(),
  });
  state.events.sort((a, b) => new Date(a.at) - new Date(b.at));
  saveEvents();
  render();
}

function bindEvents() {
  els.wakeButton.addEventListener("click", handleWake);
  els.sleepButton.addEventListener("click", () => addEvent("sleep"));
  els.sleeplessButton.addEventListener("click", () => markSleepless());
  els.clearTodayButton.addEventListener("click", clearToday);
  els.quickTextForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addAwakeText(els.quickText.value.trim());
    els.quickText.value = "";
  });
  els.manualForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addRange(els.manualType.value, els.startTime.value, els.endTime.value);
    setManualDefaults();
  });
  els.rangeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.range = button.dataset.range;
      els.rangeButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderChart();
    });
  });
  els.logList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-id]");
    if (!button) return;
    state.events = state.events.filter((item) => item.id !== button.dataset.id);
    saveEvents();
    render();
  });
}

function render() {
  renderToday();
  renderTimeline();
  renderChart();
  renderLog();
}

bindEvents();
setManualDefaults();
render();
