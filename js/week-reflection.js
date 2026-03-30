const weekReflectionState = {
  session: null,
  weekStart: null,
  record: null,
};

const weekReflectionDates = document.querySelector("#week-reflection-dates");
const weekReflectionWord = document.querySelector("#week-reflection-word");
const weekReflectionInput = document.querySelector("#week-reflection-input");
const weekReflectionStatus = document.querySelector("#week-reflection-status");
const saveWeekReflectionButton = document.querySelector("#save-week-reflection-button");

function getRequestedWeekStart() {
  const params = new URLSearchParams(window.location.search);
  const week = params.get("week");
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    return null;
  }
  return week;
}

function getWeekMode(weekStartKey) {
  const start = new Date(`${weekStartKey}T00:00:00`);
  const end = BetterApp.addDays(start, 6);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today < start) {
    return "locked";
  }
  if (today > end) {
    return "view";
  }
  return "edit";
}

function renderWeekReflection() {
  const weekStartKey = weekReflectionState.weekStart;
  const start = new Date(`${weekStartKey}T00:00:00`);
  const end = BetterApp.addDays(start, 6);
  const mode = getWeekMode(weekStartKey);
  const word = weekReflectionState.record?.word || "unset";

  weekReflectionDates.textContent = `${BetterApp.formatShortDate(start)} - ${BetterApp.formatShortDate(end)}`;
  weekReflectionWord.textContent = word;
  weekReflectionInput.value = weekReflectionState.record?.reflection || "";

  if (mode === "edit") {
    weekReflectionStatus.textContent = "write for this week";
    weekReflectionInput.disabled = false;
    saveWeekReflectionButton.disabled = false;
    saveWeekReflectionButton.classList.remove("inactive");
    weekReflectionWord.disabled = false;
    return;
  }

  if (mode === "view") {
    weekReflectionStatus.textContent = "this week has passed and is now view only";
  } else {
    weekReflectionStatus.textContent = "this week has not started yet";
  }

  weekReflectionInput.disabled = true;
  saveWeekReflectionButton.disabled = true;
  saveWeekReflectionButton.classList.add("inactive");
  weekReflectionWord.disabled = true;
}

async function loadWeekRecord() {
  const { data, error } = await supabaseClient
    .from("weekly_reflections")
    .select("id, week_start, word, reflection")
    .eq("week_start", weekReflectionState.weekStart)
    .maybeSingle();

  if (error) {
    throw error;
  }

  weekReflectionState.record = data;
}

async function saveWeekReflection() {
  const mode = getWeekMode(weekReflectionState.weekStart);
  if (mode !== "edit") {
    throw new Error("This reflection is not editable right now.");
  }

  const payload = {
    user_id: weekReflectionState.session.user.id,
    week_start: weekReflectionState.weekStart,
    word: weekReflectionState.record?.word || "unset",
    reflection: weekReflectionInput.value.trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("weekly_reflections")
    .upsert(payload, { onConflict: "user_id,week_start" })
    .select("id, week_start, word, reflection")
    .single();

  if (error) {
    throw error;
  }

  weekReflectionState.record = data;
}

async function updateWeekWord() {
  const mode = getWeekMode(weekReflectionState.weekStart);
  if (mode !== "edit") {
    throw new Error("This week word is not editable right now.");
  }

  const nextWord = window.prompt("edit the week word:", weekReflectionState.record?.word || "");
  if (nextWord === null) {
    return;
  }

  const word = nextWord.trim() || "unset";
  const payload = {
    user_id: weekReflectionState.session.user.id,
    week_start: weekReflectionState.weekStart,
    word,
    reflection: weekReflectionState.record?.reflection || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("weekly_reflections")
    .upsert(payload, { onConflict: "user_id,week_start" })
    .select("id, week_start, word, reflection")
    .single();

  if (error) {
    throw error;
  }

  weekReflectionState.record = data;
}

saveWeekReflectionButton?.addEventListener("click", async () => {
  try {
    showMessage("Saving reflection...");
    await saveWeekReflection();
    renderWeekReflection();
    showMessage("Reflection saved.");
  } catch (error) {
    showMessage(error.message || "Unable to save reflection.", "error");
  }
});

weekReflectionWord?.addEventListener("click", async () => {
  try {
    showMessage("Updating week word...");
    await updateWeekWord();
    renderWeekReflection();
    showMessage("");
  } catch (error) {
    showMessage(error.message || "Unable to update week word.", "error");
  }
});

(async function initializeWeekReflectionPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    const weekStart = getRequestedWeekStart();
    if (!weekStart) {
      window.location.href = "reflection.html";
      return;
    }

    weekReflectionState.session = app.session;
    weekReflectionState.weekStart = weekStart;
    await loadWeekRecord();
    renderWeekReflection();
    showMessage("");
  } catch (error) {
    showMessage(error.message || "Unable to load week reflection.", "error");
  }
})();
