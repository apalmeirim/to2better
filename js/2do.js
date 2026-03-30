const todoState = {
  session: null,
  tasks: [],
  intervalId: null,
  deleteArmedId: null,
};

const createTodoButton = document.querySelector("#create-todo-button");
const todoList = document.querySelector("#todo-list");

function renderTodoTasks() {
  if (!todoState.tasks.length) {
    todoList.innerHTML = `
      <div class="empty-state">
        <p>add as many 2do tasks as you want.</p>
      </div>
    `;
    return;
  }

  todoList.innerHTML = todoState.tasks
    .map((task) => {
      const isDone = Boolean(task.completed_at);
      const showDelete = todoState.deleteArmedId === task.id;
      return `
        <article class="task-card" data-task-id="${task.id}">
          <div class="task-row">
            <div>
              <button type="button" data-action="toggle-todo" class="timer-name-button ${isDone ? "task-done" : ""}">${BetterApp.escapeHtml(task.title)}</button>
              <p class="task-streak" data-role="elapsed">${BetterApp.formatElapsedTime(task.created_at)}</p>
            </div>
          </div>
          <div class="timer-actions ${showDelete ? "" : "hidden"}">
            <button type="button" data-action="delete-todo" class="link-button">delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateTodoTimes() {
  todoList.querySelectorAll("[data-task-id]").forEach((card) => {
    const task = todoState.tasks.find((item) => item.id === card.getAttribute("data-task-id"));
    const elapsed = card.querySelector('[data-role="elapsed"]');
    if (task && elapsed) {
      elapsed.textContent = BetterApp.formatElapsedTime(task.created_at);
    }
  });
}

function startTodoInterval() {
  if (todoState.intervalId) {
    window.clearInterval(todoState.intervalId);
  }
  updateTodoTimes();
  todoState.intervalId = window.setInterval(updateTodoTimes, 1000);
}

async function reloadTodoData() {
  const { data, error } = await supabaseClient
    .from("todo_tasks")
    .select("id, title, created_at, completed_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  todoState.tasks = data || [];
  renderTodoTasks();
  startTodoInterval();
  showMessage("");
}

async function createTodo(title) {
  const { error } = await supabaseClient.from("todo_tasks").insert({
    user_id: todoState.session.user.id,
    title: title.trim(),
  });

  if (error) {
    throw error;
  }
}

async function completeTodo(taskId) {
  const { error } = await supabaseClient
    .from("todo_tasks")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", taskId);

  if (error) {
    throw error;
  }
}

async function deleteTodo(taskId) {
  const { error } = await supabaseClient.from("todo_tasks").delete().eq("id", taskId);
  if (error) {
    throw error;
  }
}

createTodoButton?.addEventListener("click", async () => {
  const title = window.prompt("write a 2do task:", "");
  if (title === null || !title.trim()) {
    return;
  }

  try {
    showMessage("Adding 2do...");
    await createTodo(title);
    await reloadTodoData();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

todoList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const taskId = button.closest("[data-task-id]")?.getAttribute("data-task-id");
  if (!taskId) {
    return;
  }

  const task = todoState.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  try {
    if (button.dataset.action === "toggle-todo") {
      if (!task.completed_at) {
        showMessage("Marking 2do complete...");
        await completeTodo(taskId);
        todoState.deleteArmedId = null;
        await reloadTodoData();
        return;
      }

      todoState.deleteArmedId = todoState.deleteArmedId === taskId ? null : taskId;
      renderTodoTasks();
      return;
    }

    if (button.dataset.action === "delete-todo") {
      showMessage("Deleting 2do...");
      await deleteTodo(taskId);
      todoState.deleteArmedId = null;
      await reloadTodoData();
    }
  } catch (error) {
    showMessage(error.message, "error");
  }
});

(async function initializeTodoPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    todoState.session = app.session;
    await reloadTodoData();
  } catch (error) {
    showMessage(error.message || "Unable to load 2do.", "error");
  }
})();
