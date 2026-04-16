const growState = {
  session: null,
  tasks: [],
  logs: [],
  resetDayTime: "00:00",
};

const creategrowButton = document.querySelector("#create-grow-button");
const resetDayButton = document.querySelector("#reset-day-button");
const resetDayDialog = document.querySelector("#reset-day-dialog");
const resetDayHourInput = document.querySelector("#reset-day-hour");
const resetDayMinuteInput = document.querySelector("#reset-day-minute");
const cancelResetDayButton = document.querySelector("#cancel-reset-day-button");
const growList = document.querySelector("#grow-list");

function splitResetDayTime(value) {
  const normalized = BetterApp.normalizeTimeValue(value);
  const [hours, minutes] = normalized.split(":");
  return { hours, minutes };
}

function getResetDayInputValue() {
  const hours = String(resetDayHourInput?.value || "00").padStart(2, "0");
  const minutes = String(resetDayMinuteInput?.value || "00").padStart(2, "0");
  return BetterApp.normalizeTimeValue(`${hours}:${minutes}`);
}

function renderResetDay() {
  const normalized = BetterApp.normalizeTimeValue(growState.resetDayTime);
  growState.resetDayTime = normalized;
  const { hours, minutes } = splitResetDayTime(normalized);
  if (resetDayHourInput) {
    resetDayHourInput.value = hours;
  }
  if (resetDayMinuteInput) {
    resetDayMinuteInput.value = minutes;
  }
}

function updateResetDaySegment(segment, delta) {
  const current = splitResetDayTime(getResetDayInputValue());
  if (segment === "hour") {
    const nextHours = (Number(current.hours) + delta + 24) % 24;
    growState.resetDayTime = `${String(nextHours).padStart(2, "0")}:${current.minutes}`;
  }

  if (segment === "minute") {
    const nextMinutes = (Number(current.minutes) + delta + 60) % 60;
    growState.resetDayTime = `${current.hours}:${String(nextMinutes).padStart(2, "0")}`;
  }

  renderResetDay();
}

function bindResetDaySpinInput(input, segment) {
  input?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      updateResetDaySegment(segment, 1);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      updateResetDaySegment(segment, -1);
      return;
    }

    if (event.key === "ArrowLeft" && segment === "minute") {
      event.preventDefault();
      resetDayHourInput?.focus();
      return;
    }

    if (event.key === "ArrowRight" && segment === "hour") {
      event.preventDefault();
      resetDayMinuteInput?.focus();
      return;
    }

    if (event.key.length === 1 || event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
    }
  });
}

function rendergrowTasks() {
  if (!growState.tasks.length) {
    growList.innerHTML = `
      <div class="empty-state">
        <p>setup a daily task to create consistency.</p>
      </div>
    `;
    return;
  }

  const todayKey = BetterApp.toResetAwareDateKey(new Date(), growState.resetDayTime);
  growList.innerHTML = growState.tasks
    .map((task) => {
      const todaysLog = growState.logs.find((log) => log.task_id === task.id && log.log_date === todayKey);
      const streak = BetterApp.computeTaskStreak(growState.logs, task.id, growState.resetDayTime);

      return `
        <article class="task-card" data-task-id="${task.id}">
          <div class="task-row">
            <div>
              <button type="button" data-action="toggle-task" class="timer-name-button ${todaysLog?.completed ? "task-done" : ""}">${BetterApp.escapeHtml(task.title)}</button>
              <p class="task-streak">${streak} day streak</p>
            </div>
          </div>
          <div class="timer-actions">
            <button type="button" data-action="delete-task" class="link-button">delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

async function reloadgrowData() {
  const [tasks, logs] = await Promise.all([
    BetterApp.fetchgrowTasks(),
    BetterApp.fetchgrowLogs(),
  ]);

  growState.tasks = tasks;
  growState.logs = logs;
  rendergrowTasks();
  showMessage("");
}

async function loadResetDayTime() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("reset_day_time")
    .eq("user_id", growState.session.user.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  growState.resetDayTime = BetterApp.normalizeTimeValue(data?.reset_day_time || "00:00");
  renderResetDay();
}

async function saveResetDayTime(value) {
  const resetDayTime = BetterApp.normalizeTimeValue(value);
  const { error } = await supabaseClient
    .from("profiles")
    .update({
      reset_day_time: resetDayTime,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", growState.session.user.id);

  if (error) {
    throw error;
  }

  growState.resetDayTime = resetDayTime;
  renderResetDay();
}

async function addgrowTask(title) {
  const { error } = await supabaseClient.from("grow_tasks").insert({
    user_id: growState.session.user.id,
    title: title.trim(),
  });

  if (error) {
    throw error;
  }
}

async function togglegrowTask(taskId) {
  const today = BetterApp.toResetAwareDateKey(new Date(), growState.resetDayTime);
  const existing = growState.logs.find((item) => item.task_id === taskId && item.log_date === today);

  if (!existing) {
    const { error } = await supabaseClient.from("grow_task_logs").insert({
      task_id: taskId,
      user_id: growState.session.user.id,
      log_date: today,
      completed: true,
    });

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabaseClient
    .from("grow_task_logs")
    .update({ completed: !existing.completed })
    .eq("id", existing.id);

  if (error) {
    throw error;
  }
}

async function deletegrowTask(taskId) {
  const { error } = await supabaseClient
    .from("grow_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

creategrowButton?.addEventListener("click", async () => {
  const title = window.prompt("write a daily task:", "");
  if (title === null || !title.trim()) {
    return;
  }

  try {
    showMessage("Adding grow task...");
    await addgrowTask(title);
    await reloadgrowData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

growList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const taskId = button.closest("[data-task-id]")?.getAttribute("data-task-id");
  if (!taskId) {
    return;
  }

  try {
    if (button.dataset.action === "toggle-task") {
      showMessage("Updating daily tracker...");
      await togglegrowTask(taskId);
    }

    if (button.dataset.action === "delete-task") {
      showMessage("Removing grow task...");
      await deletegrowTask(taskId);
    }

    await reloadgrowData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

resetDayButton?.addEventListener("click", () => {
  renderResetDay();
  resetDayDialog?.showModal();
  resetDayHourInput?.focus();
});

cancelResetDayButton?.addEventListener("click", () => {
  resetDayDialog?.close();
});

resetDayDialog?.addEventListener("close", () => {
  renderResetDay();
});

resetDayDialog?.querySelector("form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    showMessage("Saving reset time...");
    await saveResetDayTime(getResetDayInputValue());
    resetDayDialog.close();
    await reloadgrowData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

(async function initializegrowPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    growState.session = app.session;
    await loadResetDayTime();
    await reloadgrowData();
  } catch (error) {
    showMessage(error.message || "Unable to load grow.", "error");
  }
})();

bindResetDaySpinInput(resetDayHourInput, "hour");
bindResetDaySpinInput(resetDayMinuteInput, "minute");
