const logsState = {
  session: null,
  profileCreatedAt: null,
  timerResets: [],
  growthLogs: [],
  growthTasks: [],
  weeklyReflections: [],
  monthlyChapters: [],
  visibleMonth: BetterApp.startOfMonth(),
  selectedDayKey: BetterApp.toDateKey(),
};

const calendarMonthTitle = document.querySelector("#calendar-month-title");
const calendarGridBody = document.querySelector("#calendar-grid-body");
const calendarPrevButton = document.querySelector("#calendar-prev-button");
const calendarNextButton = document.querySelector("#calendar-next-button");
const dayLogPanel = document.querySelector("#day-log-panel");
const selectedDayTitle = document.querySelector("#selected-day-title");
const selectedWeekWord = document.querySelector("#selected-week-word");
const selectedTasksList = document.querySelector("#selected-tasks-list");
const selectedResetsList = document.querySelector("#selected-resets-list");

function getTaskName(taskId) {
  return logsState.growthTasks.find((task) => task.id === taskId)?.title || "Task";
}

function getWeekWordForDay(dayKey) {
  const weekKey = BetterApp.toDateKey(BetterApp.startOfWeek(new Date(`${dayKey}T00:00:00`)));
  return logsState.weeklyReflections.find((item) => item.week_start === weekKey)?.word || "No word set";
}

function getCompletedTasksForDay(dayKey) {
  return logsState.growthLogs
    .filter((log) => log.log_date === dayKey && log.completed)
    .map((log) => getTaskName(log.task_id));
}

function getResetsForDay(dayKey) {
  return logsState.timerResets.filter((log) => log.reset_at.slice(0, 10) === dayKey);
}

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function renderSelectedDay() {
  if (!logsState.selectedDayKey) {
    dayLogPanel.classList.add("hidden");
    return;
  }

  const dayKey = logsState.selectedDayKey;
  const tasks = getCompletedTasksForDay(dayKey);
  const resets = getResetsForDay(dayKey);

  dayLogPanel.classList.remove("hidden");
  selectedDayTitle.textContent = BetterApp.formatShortDate(new Date(`${dayKey}T00:00:00`));
  selectedWeekWord.textContent = getWeekWordForDay(dayKey);

  selectedTasksList.innerHTML = tasks.length
    ? tasks.map((task) => `<p class="log-meta">${BetterApp.escapeHtml(task)}</p>`).join("")
    : `<p class="log-meta">No completed tasks.</p>`;

  selectedResetsList.innerHTML = resets.length
    ? resets
        .map(
          (reset) => `
            <div class="stack stack-tight">
              <p class="log-meta">${BetterApp.escapeHtml(reset.timer_name || "Timer")}</p>
              <p class="log-meta">${new Date(reset.reset_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          `
        )
        .join("")
    : `<p class="log-meta">No resets.</p>`;
}

function renderCalendar() {
  const year = logsState.visibleMonth.getFullYear();
  const monthIndex = logsState.visibleMonth.getMonth();
  const monthStart = new Date(year, monthIndex, 1);
  const firstDayIndex = (monthStart.getDay() + 6) % 7;
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(monthStart);
  const createdAt = logsState.profileCreatedAt ? new Date(logsState.profileCreatedAt) : null;
  const today = new Date();
  createdAt?.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  calendarMonthTitle.textContent = monthLabel;
  calendarGridBody.innerHTML = "";

  for (let index = 0; index < firstDayIndex; index += 1) {
    const spacer = document.createElement("span");
    spacer.className = "calendar-empty";
    calendarGridBody.appendChild(spacer);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = BetterApp.toDateKey(new Date(year, monthIndex, day));
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = String(day);
    button.className = "calendar-day";
    const dayDate = new Date(`${dayKey}T00:00:00`);
    const isClickable = (!createdAt || dayDate >= createdAt) && dayDate <= today;

    if (isClickable) {
      button.classList.add("available");
      if (logsState.selectedDayKey === dayKey) {
        button.classList.add("is-selected");
      }
      button.addEventListener("click", () => {
        logsState.selectedDayKey = dayKey;
        renderSelectedDay();
        renderCalendar();
      });
    } else {
      button.disabled = true;
    }

    calendarGridBody.appendChild(button);
  }
}

async function reloadLogsData() {
  const [timerResets, growthLogs, growthTasks, weeklyReflections, monthlyChapters] = await Promise.all([
    BetterApp.fetchTimerResets(logsState.session.user.id),
    BetterApp.fetchGrowthLogs(),
    BetterApp.fetchGrowthTasks(),
    BetterApp.fetchWeeklyReflections(),
    BetterApp.fetchMonthlyChapters(),
  ]);

  logsState.timerResets = timerResets;
  logsState.growthLogs = growthLogs;
  logsState.growthTasks = growthTasks;
  logsState.weeklyReflections = weeklyReflections;
  logsState.monthlyChapters = monthlyChapters;

  renderCalendar();
  renderSelectedDay();
  showMessage("");
}

calendarPrevButton?.addEventListener("click", () => {
  logsState.visibleMonth = new Date(logsState.visibleMonth.getFullYear(), logsState.visibleMonth.getMonth() - 1, 1);
  renderCalendar();
});

calendarNextButton?.addEventListener("click", () => {
  logsState.visibleMonth = new Date(logsState.visibleMonth.getFullYear(), logsState.visibleMonth.getMonth() + 1, 1);
  renderCalendar();
});

(async function initializeLogsPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    logsState.session = app.session;
    logsState.profileCreatedAt = app.profile?.created_at || null;
    await reloadLogsData();
  } catch (error) {
    showMessage(error.message || "Unable to load logs.", "error");
  }
})();
