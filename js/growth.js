const growState = {
  session: null,
  tasks: [],
  logs: [],
};

const creategrowButton = document.querySelector("#create-grow-button");
const growList = document.querySelector("#grow-list");

function rendergrowTasks() {
  if (!growState.tasks.length) {
    growList.innerHTML = `
      <div class="empty-state">
        <p>setup a daily task to create consistency.</p>
      </div>
    `;
    return;
  }

  const todayKey = BetterApp.toDateKey();
  growList.innerHTML = growState.tasks
    .map((task) => {
      const todaysLog = growState.logs.find((log) => log.task_id === task.id && log.log_date === todayKey);
      const streak = BetterApp.computeTaskStreak(growState.logs, task.id);

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
  const today = BetterApp.toDateKey();
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

(async function initializegrowPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    growState.session = app.session;
    await reloadgrowData();
  } catch (error) {
    showMessage(error.message || "Unable to load grow.", "error");
  }
})();
