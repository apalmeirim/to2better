const controlState = {
  session: null,
  timers: [],
  timerResets: [],
  timerIntervalId: null,
  pendingResetTimerId: null,
};

const createTimerButton = document.querySelector("#create-timer-button");
const timersList = document.querySelector("#timers-list");
const resetConfirmDialog = document.querySelector("#reset-confirm-dialog");
const resetConfirmCopy = document.querySelector("#reset-confirm-copy");
const cancelResetButton = document.querySelector("#cancel-reset-button");

function openResetConfirmDialog(timerId) {
  const timer = controlState.timers.find((item) => item.id === timerId);
  if (!timer) {
    return;
  }

  controlState.pendingResetTimerId = timerId;
  if (resetConfirmCopy) {
    resetConfirmCopy.textContent = `reset ${timer.name.toLowerCase()}?`;
  }
  resetConfirmDialog?.showModal();
}

function closeResetConfirmDialog() {
  controlState.pendingResetTimerId = null;
  resetConfirmDialog?.close();
}

function renderTimers() {
  if (!controlState.timers.length) {
    timersList.innerHTML = `
      <div class="empty-state">
        <p>setup timers to end bad habits, or create good ones.</p>
      </div>
    `;
    return;
  }

  timersList.innerHTML = controlState.timers
    .map((timer) => `
      <article class="timer-card" data-id="${timer.id}">
        <button type="button" data-action="rename" class="timer-name-button">${BetterApp.escapeHtml(timer.name)}</button>
        <p class="timer-display" data-role="elapsed">${BetterApp.formatElapsedTime(timer.started_at)}</p>
        <div class="timer-meta">
          <span>started ${BetterApp.formatDate(timer.started_at)}</span>
          <span>${controlState.timerResets.filter((item) => item.timer_id === timer.id).length} resets</span>
        </div>
        <div class="timer-actions">
          <button type="button" data-action="restart" class="link-button">reset</button>
          <button type="button" data-action="delete" class="link-button">delete</button>
        </div>
      </article>
    `)
    .join("");
}

function updateTimerDisplays() {
  timersList.querySelectorAll("[data-id]").forEach((card) => {
    const timer = controlState.timers.find((item) => item.id === card.getAttribute("data-id"));
    const display = card.querySelector('[data-role="elapsed"]');
    if (timer && display) {
      display.textContent = BetterApp.formatElapsedTime(timer.started_at);
    }
  });
}

function startDisplayInterval() {
  if (controlState.timerIntervalId) {
    window.clearInterval(controlState.timerIntervalId);
  }
  updateTimerDisplays();
  controlState.timerIntervalId = window.setInterval(updateTimerDisplays, 1000);
}

async function reloadControlData() {
  const [timers, timerResets] = await Promise.all([
    BetterApp.fetchTimers(),
    BetterApp.fetchTimerResets(controlState.session.user.id),
  ]);

  controlState.timers = timers;
  controlState.timerResets = timerResets;
  renderTimers();
  startDisplayInterval();
  showMessage("");
}

async function createTimer(name) {
  const { error } = await supabaseClient.from("timers").insert({
    user_id: controlState.session.user.id,
    name: name.trim() || "Timer",
  });

  if (error) {
    throw error;
  }
}

async function restartTimer(id) {
  const timer = controlState.timers.find((item) => item.id === id);
  if (!timer) {
    return;
  }

  const now = new Date().toISOString();
  const { error: logError } = await supabaseClient.from("timer_resets").insert({
    timer_id: id,
    user_id: controlState.session.user.id,
    previous_started_at: timer.started_at,
    reset_at: now,
  });

  if (logError) {
    throw logError;
  }

  const { error } = await supabaseClient
    .from("timers")
    .update({ started_at: now, updated_at: now })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

async function renameTimer(id, currentName) {
  const nextName = window.prompt("edit the timer name:", currentName);
  if (nextName === null) {
    return;
  }

  const { error } = await supabaseClient
    .from("timers")
    .update({ name: nextName.trim() || "Timer", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw error;
  }
}

async function deleteTimer(id) {
  const { error } = await supabaseClient.from("timers").delete().eq("id", id);
  if (error) {
    throw error;
  }
}

createTimerButton?.addEventListener("click", async () => {
  const name = window.prompt("write a name for the stop timer:", "Timer");
  if (name === null) {
    return;
  }

  try {
    showMessage("Adding timer...");
    await createTimer(name);
    await reloadControlData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

timersList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const id = button.closest("[data-id]")?.getAttribute("data-id");
  if (!id) {
    return;
  }

  try {
    if (button.dataset.action === "restart") {
      openResetConfirmDialog(id);
      return;
    }

    if (button.dataset.action === "rename") {
      await renameTimer(id, button.textContent || "Timer");
    }

    if (button.dataset.action === "delete") {
      showMessage("Deleting timer...");
      await deleteTimer(id);
    }

    await reloadControlData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

cancelResetButton?.addEventListener("click", () => {
  closeResetConfirmDialog();
});

resetConfirmDialog?.addEventListener("close", () => {
  controlState.pendingResetTimerId = null;
});

resetConfirmDialog?.querySelector("form")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const timerId = controlState.pendingResetTimerId;
  if (!timerId) {
    closeResetConfirmDialog();
    return;
  }

  try {
    showMessage("Resetting timer...");
    await restartTimer(timerId);
    closeResetConfirmDialog();
    await reloadControlData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

(async function initializeControlPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    controlState.session = app.session;
    await reloadControlData();
  } catch (error) {
    showMessage(error.message || "Unable to load control.", "error");
  }
})();
