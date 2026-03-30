const reflectionState = {
  session: null,
  profileCreatedAt: null,
  weeklyReflections: [],
  monthlyChapters: [],
  baseWeekStart: null,
  visibleGroupStart: null,
};

const reflectionTitle = document.querySelector("#reflection-title");
const reflectionDates = document.querySelector("#reflection-dates");
const reflectionLinks = document.querySelector("#reflection-links");
const reflectionPrevButton = document.querySelector("#reflection-prev-button");
const reflectionNextButton = document.querySelector("#reflection-next-button");

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
  return reflectionState.weeklyReflections.find((item) => item.week_start === weekKey) || null;
}

function getMonthRecord(monthStart) {
  const monthKey = BetterApp.toDateKey(monthStart);
  return reflectionState.monthlyChapters.find((item) => item.month_start === monthKey) || null;
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

function renderReflectionPage() {
  const weeks = buildGroupWeeks(reflectionState.visibleGroupStart);
  const groupEnd = weeks[weeks.length - 1].end;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = BetterApp.startOfMonth(reflectionState.visibleGroupStart);
  const monthRecord = getMonthRecord(monthStart);
  const monthStarted = today.getTime() >= weeks[0].start.getTime();
  reflectionTitle.textContent = monthRecord?.word || (monthStarted ? "set now!" : "?");
  reflectionTitle.disabled = !monthStarted;
  reflectionTitle.classList.toggle("inactive", !monthStarted);
  reflectionDates.textContent = `${BetterApp.formatShortDate(weeks[0].start)} - ${BetterApp.formatShortDate(groupEnd)}`;
  const currentWeekKey = BetterApp.toDateKey(BetterApp.startOfWeek(today));
  const previousGroupStart = addDays(reflectionState.visibleGroupStart, -28);
  reflectionPrevButton.disabled = previousGroupStart < reflectionState.baseWeekStart;
  reflectionPrevButton.classList.toggle("inactive", reflectionPrevButton.disabled);

  reflectionLinks.innerHTML = weeks
    .map((week) => {
      const unlocked = week.start >= reflectionState.baseWeekStart;
      const weekKey = BetterApp.toDateKey(week.start);
      const label = week.record?.word || "?";
      const isCurrentWeek = weekKey === currentWeekKey;
      return `
        <a
          href="${unlocked ? `week-reflection.html?week=${weekKey}` : "#"}"
          class="link-button reflection-link ${unlocked ? "" : "inactive"} ${isCurrentWeek ? "reflection-link-current" : ""}"
          ${unlocked ? "" : 'aria-disabled="true" tabindex="-1"'}
        >
          ${BetterApp.escapeHtml(label)}
        </a>
      `;
    })
    .join("");
}

async function reloadReflectionData() {
  const [weeklyReflections, monthlyChapters] = await Promise.all([
    BetterApp.fetchWeeklyReflections(),
    BetterApp.fetchMonthlyChapters(),
  ]);
  reflectionState.weeklyReflections = weeklyReflections;
  reflectionState.monthlyChapters = monthlyChapters;
  renderReflectionPage();
  showMessage("");
}

async function updateMonthWord() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (today < reflectionState.visibleGroupStart) {
    throw new Error("This month word is not editable yet.");
  }

  const monthStart = BetterApp.startOfMonth(reflectionState.visibleGroupStart);
  const currentRecord = getMonthRecord(monthStart);
  const nextWord = window.prompt("edit the month word:", currentRecord?.word || "");
  if (nextWord === null) {
    return;
  }

  const word = nextWord.trim() || "unset";
  const { error } = await supabaseClient.from("monthly_chapters").upsert(
    {
      user_id: reflectionState.session.user.id,
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

reflectionPrevButton?.addEventListener("click", () => {
  const previousGroupStart = addDays(reflectionState.visibleGroupStart, -28);
  if (previousGroupStart < reflectionState.baseWeekStart) {
    return;
  }

  reflectionState.visibleGroupStart = addDays(reflectionState.visibleGroupStart, -28);
  renderReflectionPage();
});

reflectionNextButton?.addEventListener("click", () => {
  reflectionState.visibleGroupStart = addDays(reflectionState.visibleGroupStart, 28);
  renderReflectionPage();
});

reflectionTitle?.addEventListener("click", async () => {
  try {
    showMessage("Updating month word...");
    await updateMonthWord();
    await reloadReflectionData();
  } catch (error) {
    showMessage(error.message || "Unable to update month word.", "error");
  }
});

(async function initializeReflectionPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    reflectionState.session = app.session;
    reflectionState.profileCreatedAt = app.profile?.created_at || new Date().toISOString();

    const baseWeekStart = BetterApp.startOfWeek(new Date(reflectionState.profileCreatedAt));
    reflectionState.baseWeekStart = baseWeekStart;
    const currentWeekStart = BetterApp.startOfWeek(new Date());
    const weekOffset = Math.max(0, diffWeeks(baseWeekStart, currentWeekStart));
    const groupOffset = Math.floor(weekOffset / 4) * 28;
    reflectionState.visibleGroupStart = addDays(baseWeekStart, groupOffset);

    await reloadReflectionData();
  } catch (error) {
    showMessage(error.message || "Unable to load reflection.", "error");
  }
})();
