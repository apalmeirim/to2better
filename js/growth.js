const growthState = {
  session: null,
  tasks: [],
  logs: [],
};

const createGrowthButton = document.querySelector("#create-growth-button");
const growthList = document.querySelector("#growth-list");

function renderGrowthTasks() {
  if (!growthState.tasks.length) {
    growthList.innerHTML = `
      <div class="empty-state">
        <p>setup a daily task to create consistency.</p>
      </div>
    `;
    return;
  }

  const todayKey = BetterApp.toDateKey();
  growthList.innerHTML = growthState.tasks
    .map((task) => {
      const todaysLog = growthState.logs.find((log) => log.task_id === task.id && log.log_date === todayKey);
      const streak = BetterApp.computeTaskStreak(growthState.logs, task.id);

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

async function reloadGrowthData() {
  const [tasks, logs] = await Promise.all([
    BetterApp.fetchGrowthTasks(),
    BetterApp.fetchGrowthLogs(),
  ]);

  growthState.tasks = tasks;
  growthState.logs = logs;
  renderGrowthTasks();
  showMessage("");
}

async function addGrowthTask(title) {
  const { error } = await supabaseClient.from("growth_tasks").insert({
    user_id: growthState.session.user.id,
    title: title.trim(),
  });

  if (error) {
    throw error;
  }
}

async function toggleGrowthTask(taskId) {
  const today = BetterApp.toDateKey();
  const existing = growthState.logs.find((item) => item.task_id === taskId && item.log_date === today);

  if (!existing) {
    const { error } = await supabaseClient.from("growth_task_logs").insert({
      task_id: taskId,
      user_id: growthState.session.user.id,
      log_date: today,
      completed: true,
    });

    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabaseClient
    .from("growth_task_logs")
    .update({ completed: !existing.completed })
    .eq("id", existing.id);

  if (error) {
    throw error;
  }
}

async function deleteGrowthTask(taskId) {
  const { error } = await supabaseClient
    .from("growth_tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

createGrowthButton?.addEventListener("click", async () => {
  const title = window.prompt("write a daily task:", "");
  if (title === null || !title.trim()) {
    return;
  }

  try {
    showMessage("Adding growth task...");
    await addGrowthTask(title);
    await reloadGrowthData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

growthList?.addEventListener("click", async (event) => {
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
      await toggleGrowthTask(taskId);
    }

    if (button.dataset.action === "delete-task") {
      showMessage("Removing growth task...");
      await deleteGrowthTask(taskId);
    }

    await reloadGrowthData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

(async function initializeGrowthPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    growthState.session = app.session;
    await reloadGrowthData();
  } catch (error) {
    showMessage(error.message || "Unable to load growth.", "error");
  }
})();
