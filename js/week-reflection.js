const weekreflectState = {
  session: null,
  weekStart: null,
  record: null,
};

const weekreflectDates = document.querySelector("#week-reflect-dates");
const weekreflectWord = document.querySelector("#week-reflect-word");
const weekreflectInput = document.querySelector("#week-reflect-input");
const weekreflectStatus = document.querySelector("#week-reflect-status");
const saveWeekreflectButton = document.querySelector("#save-week-reflect-button");

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

function renderWeekreflect() {
  const weekStartKey = weekreflectState.weekStart;
  const start = new Date(`${weekStartKey}T00:00:00`);
  const end = BetterApp.addDays(start, 6);
  const mode = getWeekMode(weekStartKey);
  const word = weekreflectState.record?.word || "unset";

  weekreflectDates.textContent = `${BetterApp.formatShortDate(start)} - ${BetterApp.formatShortDate(end)}`;
  weekreflectWord.textContent = word;
  weekreflectInput.value = weekreflectState.record?.reflect || "";

  if (mode === "edit") {
    weekreflectStatus.textContent = "write for this week";
    weekreflectInput.disabled = false;
    saveWeekreflectButton.disabled = false;
    saveWeekreflectButton.classList.remove("inactive");
    weekreflectWord.disabled = false;
    return;
  }

  if (mode === "view") {
    weekreflectStatus.textContent = "this week has passed and is now view only";
  } else {
    weekreflectStatus.textContent = "this week has not started yet";
  }

  weekreflectInput.disabled = true;
  saveWeekreflectButton.disabled = true;
  saveWeekreflectButton.classList.add("inactive");
  weekreflectWord.disabled = true;
}

async function loadWeekRecord() {
  const { data, error } = await supabaseClient
    .from("weekly_reflects")
    .select("id, week_start, word, reflect")
    .eq("week_start", weekreflectState.weekStart)
    .maybeSingle();

  if (error) {
    throw error;
  }

  weekreflectState.record = data;
}

async function saveWeekreflect() {
  const mode = getWeekMode(weekreflectState.weekStart);
  if (mode !== "edit") {
    throw new Error("This reflect is not editable right now.");
  }

  const payload = {
    user_id: weekreflectState.session.user.id,
    week_start: weekreflectState.weekStart,
    word: weekreflectState.record?.word || "unset",
    reflect: weekreflectInput.value.trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("weekly_reflects")
    .upsert(payload, { onConflict: "user_id,week_start" })
    .select("id, week_start, word, reflect")
    .single();

  if (error) {
    throw error;
  }

  weekreflectState.record = data;
}

async function updateWeekWord() {
  const mode = getWeekMode(weekreflectState.weekStart);
  if (mode !== "edit") {
    throw new Error("This week word is not editable right now.");
  }

  const nextWord = window.prompt("edit the week word:", weekreflectState.record?.word || "");
  if (nextWord === null) {
    return;
  }

  const word = nextWord.trim() || "unset";
  const payload = {
    user_id: weekreflectState.session.user.id,
    week_start: weekreflectState.weekStart,
    word,
    reflect: weekreflectState.record?.reflect || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseClient
    .from("weekly_reflects")
    .upsert(payload, { onConflict: "user_id,week_start" })
    .select("id, week_start, word, reflect")
    .single();

  if (error) {
    throw error;
  }

  weekreflectState.record = data;
}

saveWeekreflectButton?.addEventListener("click", async () => {
  try {
    showMessage("Saving reflect...");
    await saveWeekreflect();
    renderWeekreflect();
    showMessage("reflect saved.");
  } catch (error) {
    showMessage(error.message || "Unable to save reflect.", "error");
  }
});

weekreflectWord?.addEventListener("click", async () => {
  try {
    showMessage("Updating week word...");
    await updateWeekWord();
    renderWeekreflect();
    showMessage("");
  } catch (error) {
    showMessage(error.message || "Unable to update week word.", "error");
  }
});

(async function initializeWeekreflectPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    const weekStart = getRequestedWeekStart();
    if (!weekStart) {
      window.location.href = "reflect.html";
      return;
    }

    weekreflectState.session = app.session;
    weekreflectState.weekStart = weekStart;
    await loadWeekRecord();
    renderWeekreflect();
    showMessage("");
  } catch (error) {
    showMessage(error.message || "Unable to load week reflect.", "error");
  }
})();
