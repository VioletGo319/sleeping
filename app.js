const storageKey = "sleep-manager-events-v1";
const metaStorageKey = "sleep-manager-daily-meta-v1";
const settingsStorageKey = "sleep-manager-settings-v1";
const dayMs = 24 * 60 * 60 * 1000;

const state = {
  events: loadEvents(),
  dailyMeta: loadDailyMeta(),
  settings: loadSettings(),
  range: "week",
  metric: "sleep",
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
  currentStatus: document.querySelector("#currentStatus"),
  sleepScore: document.querySelector("#sleepScore"),
  weekAverage: document.querySelector("#weekAverage"),
  sleepDebt: document.querySelector("#sleepDebt"),
  regularity: document.querySelector("#regularity"),
  insightList: document.querySelector("#insightList"),
  checkinStatus: document.querySelector("#checkinStatus"),
  goalForm: document.querySelector("#goalForm"),
  sleepGoal: document.querySelector("#sleepGoal"),
  checkinForm: document.querySelector("#checkinForm"),
  qualityRange: document.querySelector("#qualityRange"),
  qualityValue: document.querySelector("#qualityValue"),
  energyRange: document.querySelector("#energyRange"),
  energyValue: document.querySelector("#energyValue"),
  sleepNote: document.querySelector("#sleepNote"),
  exportButton: document.querySelector("#exportButton"),
  importButton: document.querySelector("#importButton"),
  importFile: document.querySelector("#importFile"),
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
  metricButtons: document.querySelectorAll(".metric-toggle button"),
  sleepHeatmap: document.querySelector("#sleepHeatmap"),
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

function loadDailyMeta() {
  try {
    return JSON.parse(localStorage.getItem(metaStorageKey) || "{}");
  } catch {
    return {};
  }
}

function loadSettings() {
  try {
    return {
      sleepGoal: 8,
      ...JSON.parse(localStorage.getItem(settingsStorageKey) || "{}"),
    };
  } catch {
    return { sleepGoal: 8 };
  }
}

function saveEvents() {
  localStorage.setItem(storageKey, JSON.stringify(state.events));
}

function saveDailyMeta() {
  localStorage.setItem(metaStorageKey, JSON.stringify(state.dailyMeta));
}

function saveSettings() {
  localStorage.setItem(settingsStorageKey, JSON.stringify(state.settings));
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

function dateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function targetHours() {
  const goal = Number(state.settings.sleepGoal);
  return Number.isFinite(goal) ? clamp(goal, 4, 12) : 8;
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
    sleepSegments: segments.filter((segment) => segment.type === "sleep" && segment.end > segment.start),
  };
}

function rangeStats(days) {
  const start = dayStart();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() - (days - index - 1) * dayMs);
    const stats = statsForDay(date);
    const dateStart = dayStart(date);
    const dateEnd = new Date(dateStart.getTime() + dayMs);
    const eventCount = state.events.filter((event) => {
      const at = new Date(event.at);
      return at >= dateStart && at < dateEnd;
    }).length;
    return {
      date,
      ...stats,
      hours: stats.sleepMs / 36e5,
      bedtime: nightBedtimeMinutes(stats.sleepSegments),
      hasData: eventCount > 0 || stats.sleepMs > 0,
    };
  });
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return 0;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function standardDeviation(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length < 2) return 0;
  const mean = average(valid);
  return Math.sqrt(average(valid.map((value) => (value - mean) ** 2)));
}

function nightBedtimeMinutes(segments) {
  const nightSegment = segments.find((segment) => {
    const hour = segment.start.getHours();
    return hour >= 18 || hour < 6;
  });
  if (!nightSegment) return NaN;
  const minutes = nightSegment.start.getHours() * 60 + nightSegment.start.getMinutes();
  return minutes < 12 * 60 ? minutes + 24 * 60 : minutes;
}

function sleepScore(todayStats, week) {
  const activeWeek = week.filter((item) => item.hasData);
  const todayHours = todayStats.sleepMs / 36e5;
  const weekAverage = average(activeWeek.map((item) => item.hours));
  const bedtimeSpread = standardDeviation(activeWeek.map((item) => item.bedtime)) / 60;
  const goal = targetHours();
  const referenceHours = todayHours > 0 ? todayHours : weekAverage || goal;
  const durationPenalty = Math.abs(referenceHours - goal) * 8;
  const shortWeekPenalty = activeWeek.length >= 3 ? Math.max(0, goal - 1 - weekAverage) * 7 : 0;
  const fragmentPenalty = todayStats.fragmentationScore * 7;
  const regularityPenalty = activeWeek.length >= 3 ? Math.min(24, bedtimeSpread * 10) : 0;
  return Math.round(clamp(100 - durationPenalty - shortWeekPenalty - fragmentPenalty - regularityPenalty, 0, 100));
}

function simpleDayScore(stats) {
  const hours = stats.sleepMs / 36e5;
  const durationPenalty = Math.abs((hours || targetHours()) - targetHours()) * 8;
  const fragmentPenalty = stats.fragmentationScore * 8;
  return Math.round(clamp(100 - durationPenalty - fragmentPenalty, 0, 100));
}

function chartMetricConfig() {
  const config = {
    sleep: {
      label: "睡眠",
      unit: "h",
      max: 12,
      value: (item) => item.hours,
      format: (value) => `${value.toFixed(value >= 10 ? 0 : 1)}h`,
      colors: ["#b8f3ff", "#6f74ff", "#4430a7"],
    },
    wake: {
      label: "醒来",
      unit: "次",
      max: 8,
      value: (item) => item.wakeCount,
      format: (value) => `${Math.round(value)}次`,
      colors: ["#ffd0bd", "#ff9f7a", "#d75d8b"],
    },
    fragment: {
      label: "零散",
      unit: "",
      max: 10,
      value: (item) => item.fragmentationScore,
      format: (value) => `${Math.round(value)}`,
      colors: ["#f8dcff", "#b13fcf", "#6a2c91"],
    },
    score: {
      label: "评分",
      unit: "",
      max: 100,
      value: (item) => simpleDayScore(item),
      format: (value) => `${Math.round(value)}`,
      colors: ["#b8f3ff", "#8df0c8", "#3bc8ac"],
    },
  };
  return config[state.metric] || config.sleep;
}

function sleepMinutesInHour(date, hour) {
  const start = dayStart(date);
  const hourStart = new Date(start.getTime() + hour * 60 * 60 * 1000);
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
  return segmentsForDay(date)
    .filter((segment) => segment.type === "sleep")
    .reduce((sum, segment) => {
      const overlapStart = Math.max(segment.start.getTime(), hourStart.getTime());
      const overlapEnd = Math.min(segment.end.getTime(), hourEnd.getTime());
      return sum + Math.max(0, overlapEnd - overlapStart) / 60000;
    }, 0);
}

function currentStatusText() {
  const now = new Date();
  const lastIndex = lastEventIndexBefore(now);
  if (lastIndex < 0) return "当前：未记录";
  const lastEvent = state.events[lastIndex];
  const minutes = Math.round((now - new Date(lastEvent.at)) / 60000);
  if (lastEvent.type === "sleep" && minutes < 45) return `当前：准备睡 ${minutes}分钟`;
  if (lastEvent.type === "sleep") return `当前：可能在睡 ${formatHours(minutes * 60000)}`;
  if (lastEvent.note) return "当前：清醒";
  return `当前：清醒 ${formatHours(Math.max(0, minutes) * 60000)}`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function adviceFromStats(stats) {
  const hours = stats.sleepMs / 36e5;
  const week = rangeStats(7);
  const activeWeek = week.filter((item) => item.hasData);
  const avgHours = average(activeWeek.map((item) => item.hours));
  const goal = targetHours();
  const debt = activeWeek.reduce((sum, item) => sum + Math.max(0, goal - item.hours), 0);
  const meta = state.dailyMeta[dateKey()];
  if (state.events.length < 2) return "先用“我醒了”和“开始睡了”记录几个节点，趋势会比单次估算更有意义。";
  if (meta?.energy && Number(meta.energy) <= 2 && hours >= goal - 0.5) return "时长接近目标但醒后精神偏低。优先看夜间中断、入睡前屏幕和压力因素。";
  if (debt >= 6) return `按 ${goal.toFixed(1)} 小时目标估算，最近 7 天累计睡眠债约 ${debt.toFixed(1)} 小时。今晚优先把睡眠窗口留够。`;
  if (avgHours > 0 && avgHours < 6.5) return `7 天平均只有 ${avgHours.toFixed(1)} 小时。建议先把目标定为连续三天不少于 7 小时。`;
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

function renderSmartInsights() {
  const todayStats = statsForDay(new Date());
  const week = rangeStats(7);
  const activeWeek = week.filter((item) => item.hasData);
  const avgHours = average(activeWeek.map((item) => item.hours));
  const goal = targetHours();
  const debt = activeWeek.reduce((sum, item) => sum + Math.max(0, goal - item.hours), 0);
  const bedtimeValues = activeWeek.map((item) => item.bedtime).filter((value) => Number.isFinite(value));
  const bedtimeSpread = standardDeviation(bedtimeValues) / 60;
  const fragmentedDays = activeWeek.filter((item) => item.fragmentationScore >= 4).length;
  const shortDays = activeWeek.filter((item) => item.hours > 0 && item.hours < 6.5).length;
  const score = sleepScore(todayStats, week);
  const meta = state.dailyMeta[dateKey()];

  els.currentStatus.textContent = currentStatusText();
  els.sleepScore.textContent = state.events.length < 2 ? "--" : `${score}`;
  els.weekAverage.textContent = avgHours > 0 ? `${avgHours.toFixed(1)}h` : "--";
  els.sleepDebt.textContent = debt > 0 ? `${debt.toFixed(1)}h` : "0h";
  els.regularity.textContent = bedtimeValues.length < 3 ? "收集中" : bedtimeSpread < 0.75 ? "稳定" : bedtimeSpread < 1.5 ? "一般" : "漂移";

  const insights = [];
  if (state.events.length < 2) {
    insights.push("数据还少。至少记录 2 到 3 个睡眠周期后，趋势判断才有参考价值。");
  } else {
    if (score >= 85) insights.push("最近状态较好：睡眠长度、连续性和节奏基本稳定。重点是继续保持固定入睡窗口。");
    if (debt >= 4) insights.push(`睡眠债偏高：按 ${goal.toFixed(1)} 小时目标估算，最近 7 天少睡约 ${debt.toFixed(1)} 小时。`);
    if (shortDays >= 3) insights.push(`短睡天数较多：最近 7 天有 ${shortDays} 天低于 6.5 小时，优先调整睡眠总时长。`);
    if (fragmentedDays >= 2) insights.push(`夜间中断偏多：最近 7 天有 ${fragmentedDays} 天比较零散，建议重点看醒来是否集中在固定时间段。`);
    if (bedtimeValues.length >= 3 && bedtimeSpread >= 1.5) insights.push(`入睡时间漂移明显：最近 7 天入睡时间波动约 ${bedtimeSpread.toFixed(1)} 小时。先固定起床时间会更容易稳定。`);
    if (meta?.tags?.length) insights.push(`今日标记了 ${meta.tags.join("、")}。连续记录几天后，可以对照评分和醒来次数看影响。`);
    if (!insights.length) insights.push("趋势没有明显风险信号。下一步可以关注醒来后的精神状态，补充主观感受会让判断更准确。");
  }

  els.insightList.innerHTML = insights
    .slice(0, 3)
    .map((insight) => `<div class="insight-item">${escapeHtml(insight)}</div>`)
    .join("");
}

function renderWellness() {
  const meta = state.dailyMeta[dateKey()] || {};
  els.sleepGoal.value = targetHours();
  els.qualityRange.value = meta.quality || 3;
  els.energyRange.value = meta.energy || 3;
  els.qualityValue.textContent = els.qualityRange.value;
  els.energyValue.textContent = els.energyRange.value;
  els.sleepNote.value = meta.note || "";
  els.checkinStatus.textContent = meta.savedAt ? "今日已复盘" : "今日未复盘";
  els.checkinForm.querySelectorAll('.tag-row input[type="checkbox"]').forEach((input) => {
    input.checked = Array.isArray(meta.tags) && meta.tags.includes(input.value);
  });
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
  const metric = chartMetricConfig();
  const width = canvas.width;
  const height = canvas.height;
  const pad = 48;
  const chartHeight = height - pad * 1.65;
  const chartWidth = width - pad * 1.35;
  const now = dayStart();
  const data = Array.from({ length: days }, (_, index) => {
    const date = new Date(now.getTime() - (days - index - 1) * dayMs);
    const stats = statsForDay(date);
    return {
      date,
      ...stats,
      hours: stats.sleepMs / 36e5,
    };
  });
  const values = data.map(metric.value);
  const maxValue = Math.max(metric.max, Math.ceil(Math.max(...values, 1)));

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#14102e";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(187, 180, 255, 0.22)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#b9b4d8";
  ctx.font = "22px system-ui";
  ctx.textAlign = "left";
  for (let i = 0; i <= 4; i += 1) {
    const value = (maxValue / 4) * i;
    const y = pad + chartHeight - (value / maxValue) * chartHeight;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad / 2, y);
    ctx.stroke();
    ctx.fillText(metric.format(value), 8, y + 7);
  }

  ctx.fillStyle = "#f7f3ff";
  ctx.font = "bold 26px system-ui";
  ctx.fillText(metric.label, pad, 30);

  const gap = days > 10 ? 7 : 18;
  const barWidth = Math.max(8, (chartWidth - gap * (days - 1)) / days);
  data.forEach((item, index) => {
    const value = metric.value(item);
    const barHeight = clamp(value / maxValue, 0, 1) * chartHeight;
    const x = pad + index * (barWidth + gap);
    const y = pad + chartHeight - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, pad + chartHeight);
    gradient.addColorStop(0, metric.colors[0]);
    gradient.addColorStop(0.52, metric.colors[1]);
    gradient.addColorStop(1, metric.colors[2]);
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, barWidth, barHeight, 6);
    ctx.fill();

    if (days === 7 && value > 0) {
      ctx.fillStyle = "#f7f3ff";
      ctx.font = "18px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(metric.format(value), x + barWidth / 2, Math.max(28, y - 8));
    }

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

function renderHeatmap() {
  const days = rangeStats(7);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  els.sleepHeatmap.innerHTML = "";

  const empty = document.createElement("div");
  empty.className = "heatmap-hour";
  els.sleepHeatmap.appendChild(empty);
  for (const hour of hours) {
    const label = document.createElement("div");
    label.className = "heatmap-hour";
    label.textContent = hour % 3 === 0 ? `${hour}` : "";
    els.sleepHeatmap.appendChild(label);
  }

  for (const day of days) {
    const rowLabel = document.createElement("div");
    rowLabel.className = "heatmap-label";
    rowLabel.textContent = `${day.date.getMonth() + 1}/${day.date.getDate()}`;
    els.sleepHeatmap.appendChild(rowLabel);

    for (const hour of hours) {
      const minutes = sleepMinutesInHour(day.date, hour);
      const ratio = clamp(minutes / 60, 0, 1);
      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.style.background = `rgba(184, 243, 255, ${0.08 + ratio * 0.82})`;
      cell.style.boxShadow = ratio > 0.65 ? "0 0 14px rgba(184, 243, 255, 0.35)" : "none";
      cell.title = `${formatDate(day.date)} ${hour}:00 睡眠 ${Math.round(minutes)} 分钟`;
      els.sleepHeatmap.appendChild(cell);
    }
  }
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
        <strong>${escapeHtml(event.note || (event.type === "awake" ? "醒来" : "开始睡"))}</strong>
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

function saveGoal(event) {
  event.preventDefault();
  state.settings.sleepGoal = targetHoursFromInput();
  saveSettings();
  render();
}

function targetHoursFromInput() {
  return clamp(Number(els.sleepGoal.value) || 8, 4, 12);
}

function saveCheckin(event) {
  event.preventDefault();
  const tags = [...els.checkinForm.querySelectorAll('.tag-row input[type="checkbox"]:checked')]
    .map((input) => input.value);
  state.dailyMeta[dateKey()] = {
    quality: Number(els.qualityRange.value),
    energy: Number(els.energyRange.value),
    tags,
    note: els.sleepNote.value.trim(),
    savedAt: new Date().toISOString(),
  };
  saveDailyMeta();
  render();
}

function exportData() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    events: state.events,
    dailyMeta: state.dailyMeta,
    settings: state.settings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sleeping-data-${dateKey()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(reader.result);
      state.events = Array.isArray(payload.events) ? payload.events.filter((event) => event.at && event.type) : state.events;
      state.dailyMeta = payload.dailyMeta && typeof payload.dailyMeta === "object" ? payload.dailyMeta : state.dailyMeta;
      state.settings = {
        ...state.settings,
        ...(payload.settings && typeof payload.settings === "object" ? payload.settings : {}),
      };
      state.events.sort((a, b) => new Date(a.at) - new Date(b.at));
      saveEvents();
      saveDailyMeta();
      saveSettings();
      render();
    } catch {
      alert("导入失败：请选择有效的 JSON 数据文件。");
    }
  });
  reader.readAsText(file);
}

function bindEvents() {
  els.wakeButton.addEventListener("click", handleWake);
  els.sleepButton.addEventListener("click", () => addEvent("sleep"));
  els.sleeplessButton.addEventListener("click", () => markSleepless());
  els.clearTodayButton.addEventListener("click", clearToday);
  els.goalForm.addEventListener("submit", saveGoal);
  els.checkinForm.addEventListener("submit", saveCheckin);
  els.qualityRange.addEventListener("input", () => {
    els.qualityValue.textContent = els.qualityRange.value;
  });
  els.energyRange.addEventListener("input", () => {
    els.energyValue.textContent = els.energyRange.value;
  });
  els.exportButton.addEventListener("click", exportData);
  els.importButton.addEventListener("click", () => els.importFile.click());
  els.importFile.addEventListener("change", () => {
    importData(els.importFile.files[0]);
    els.importFile.value = "";
  });
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
  els.metricButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.metric = button.dataset.metric;
      els.metricButtons.forEach((item) => item.classList.toggle("active", item === button));
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
  renderSmartInsights();
  renderWellness();
  renderTimeline();
  renderChart();
  renderHeatmap();
  renderLog();
}

bindEvents();
setManualDefaults();
render();
