const reflectState = {
  session: null,
  profileCreatedAt: null,
  weeklyreflects: [],
  monthlyChapters: [],
  baseWeekStart: null,
  visibleGroupStart: null,
};

const reflectTitle = document.querySelector("#reflect-title");
const reflectDates = document.querySelector("#reflect-dates");
const reflectLinks = document.querySelector("#reflect-links");
const reflectPrevButton = document.querySelector("#reflect-prev-button");
const reflectNextButton = document.querySelector("#reflect-next-button");

function addDays(dateValue, amount) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + amount);
  return date;
}

function diffWeeks(startDate, endDate) {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.floor((endDate.getTime() - startDate.getTime()) / msPerWeek);
}

function getWeekRecord(weekStart) {
  const weekKey = BetterApp.toDateKey(weekStart);
  return reflectState.weeklyreflects.find((item) => item.week_start === weekKey) || null;
}

function getMonthRecord(monthStart) {
  const monthKey = BetterApp.toDateKey(monthStart);
  return reflectState.monthlyChapters.find((item) => item.month_start === monthKey) || null;
}

function buildGroupWeeks(groupStart) {
  return Array.from({ length: 4 }, (_, index) => {
    const start = addDays(groupStart, index * 7);
    return {
      index,
      start,
      end: addDays(start, 6),
      record: getWeekRecord(start),
    };
  });
}

function renderreflectPage() {
  const weeks = buildGroupWeeks(reflectState.visibleGroupStart);
  const groupEnd = weeks[weeks.length - 1].end;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = BetterApp.startOfMonth(reflectState.visibleGroupStart);
  const monthRecord = getMonthRecord(monthStart);
  const monthStarted = today.getTime() >= weeks[0].start.getTime();
  reflectTitle.textContent = monthRecord?.word || (monthStarted ? "set now!" : "?");
  reflectTitle.disabled = !monthStarted;
  reflectTitle.classList.toggle("inactive", !monthStarted);
  reflectDates.textContent = `${BetterApp.formatShortDate(weeks[0].start)} - ${BetterApp.formatShortDate(groupEnd)}`;
  const currentWeekKey = BetterApp.toDateKey(BetterApp.startOfWeek(today));
  const previousGroupStart = addDays(reflectState.visibleGroupStart, -28);
  reflectPrevButton.disabled = previousGroupStart < reflectState.baseWeekStart;
  reflectPrevButton.classList.toggle("inactive", reflectPrevButton.disabled);

  reflectLinks.innerHTML = weeks
    .map((week) => {
      const unlocked = week.start >= reflectState.baseWeekStart;
      const weekKey = BetterApp.toDateKey(week.start);
      const label = week.record?.word || "?";
      const isCurrentWeek = weekKey === currentWeekKey;
      return `
        <a
          href="${unlocked ? `week-reflect.html?week=${weekKey}` : "#"}"
          class="link-button reflect-link ${unlocked ? "" : "inactive"} ${isCurrentWeek ? "reflect-link-current" : ""}"
          ${unlocked ? "" : 'aria-disabled="true" tabindex="-1"'}
        >
          ${BetterApp.escapeHtml(label)}
        </a>
      `;
    })
    .join("");
}

async function reloadreflectData() {
  const [weeklyreflects, monthlyChapters] = await Promise.all([
    BetterApp.fetchWeeklyreflects(),
    BetterApp.fetchMonthlyChapters(),
  ]);
  reflectState.weeklyreflects = weeklyreflects;
  reflectState.monthlyChapters = monthlyChapters;
  renderreflectPage();
  showMessage("");
}

async function updateMonthWord() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < reflectState.visibleGroupStart) {
    throw new Error("This month word is not editable yet.");
  }

  const monthStart = BetterApp.startOfMonth(reflectState.visibleGroupStart);
  const currentRecord = getMonthRecord(monthStart);
  const nextWord = window.prompt("edit the month word:", currentRecord?.word || "");
  if (nextWord === null) {
    return;
  }

  const word = nextWord.trim() || "unset";
  const { error } = await supabaseClient.from("monthly_chapters").upsert(
    {
      user_id: reflectState.session.user.id,
      month_start: BetterApp.toDateKey(monthStart),
      word,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,month_start" }
  );

  if (error) {
    throw error;
  }
}

reflectPrevButton?.addEventListener("click", () => {
  const previousGroupStart = addDays(reflectState.visibleGroupStart, -28);
  if (previousGroupStart < reflectState.baseWeekStart) {
    return;
  }

  reflectState.visibleGroupStart = addDays(reflectState.visibleGroupStart, -28);
  renderreflectPage();
});

reflectNextButton?.addEventListener("click", () => {
  reflectState.visibleGroupStart = addDays(reflectState.visibleGroupStart, 28);
  renderreflectPage();
});

reflectTitle?.addEventListener("click", async () => {
  try {
    showMessage("Updating month word...");
    await updateMonthWord();
    await reloadreflectData();
  } catch (error) {
    showMessage(error.message || "Unable to update month word.", "error");
  }
});

(async function initializereflectPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    reflectState.session = app.session;
    reflectState.profileCreatedAt = app.profile?.created_at || new Date().toISOString();

    const baseWeekStart = BetterApp.startOfWeek(new Date(reflectState.profileCreatedAt));
    reflectState.baseWeekStart = baseWeekStart;
    const currentWeekStart = BetterApp.startOfWeek(new Date());
    const weekOffset = Math.max(0, diffWeeks(baseWeekStart, currentWeekStart));
    const groupOffset = Math.floor(weekOffset / 4) * 28;
    reflectState.visibleGroupStart = addDays(baseWeekStart, groupOffset);

    await reloadreflectData();
  } catch (error) {
    showMessage(error.message || "Unable to load reflect.", "error");
  }
})();
