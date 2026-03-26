const state = {
  session: null,
  timers: [],
  timerIntervalId: null,
};

const createTimerButton = document.querySelector("#create-timer-button");
const timersList = document.querySelector("#timers-list");
const userEmail = document.querySelector("#user-email");
const signOutButton = document.querySelector("#sign-out-button");

function formatElapsedTime(startedAt) {
  const elapsedMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const secondsPerMinute = 60;
  const minutesPerHour = 60;
  const minutesPerDay = 24 * minutesPerHour;
  const minutesPerWeek = 7 * minutesPerDay;
  const secondsPerHour = secondsPerMinute * minutesPerHour;
  const secondsPerDay = secondsPerHour * 24;
  const secondsPerWeek = secondsPerDay * 7;

  let remainingSeconds = totalSeconds;
  const weeks = Math.floor(remainingSeconds / secondsPerWeek);
  remainingSeconds -= weeks * secondsPerWeek;
  const days = Math.floor(remainingSeconds / secondsPerDay);
  remainingSeconds -= days * secondsPerDay;
  const hours = Math.floor(remainingSeconds / secondsPerHour);
  remainingSeconds -= hours * secondsPerHour;
  const minutes = Math.floor(remainingSeconds / secondsPerMinute);
  remainingSeconds -= minutes * secondsPerMinute;
  const seconds = remainingSeconds;

  return `${weeks}w ${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function formatDate(value) {
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTimers() {
  if (!state.timers.length) {
    timersList.innerHTML = `
      <div class="empty-state">
        <p>No timers yet. Create one to get started.</p>
      </div>
    `;
    return;
  }

  timersList.innerHTML = state.timers
    .map((timer) => {
      return `
        <article class="timer-card" data-id="${timer.id}">
          <button type="button" data-action="rename" class="timer-name-button">${escapeHtml(timer.name)}</button>
          <p class="timer-display" data-role="elapsed">${formatElapsedTime(timer.started_at)}</p>
          <div class="timer-meta">
            <span>${formatDate(timer.started_at)}</span>
          </div>
          <div class="timer-actions">
            <button type="button" data-action="restart" class="link-button">restart</button>
            <button type="button" data-action="delete" class="link-button">delete</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateTimerDisplays() {
  const cards = timersList.querySelectorAll("[data-id]");
  cards.forEach((card) => {
    const id = card.getAttribute("data-id");
    const timer = state.timers.find((item) => item.id === id);
    const display = card.querySelector('[data-role="elapsed"]');
    if (timer && display) {
      display.textContent = formatElapsedTime(timer.started_at);
    }
  });
}

function startDisplayInterval() {
  stopDisplayInterval();
  updateTimerDisplays();
  state.timerIntervalId = window.setInterval(updateTimerDisplays, 1000);
}

function stopDisplayInterval() {
  if (state.timerIntervalId) {
    window.clearInterval(state.timerIntervalId);
    state.timerIntervalId = null;
  }
}

async function fetchTimers() {
  showMessage("Loading timers...");
  const { data, error } = await supabaseClient
    .from("timers")
    .select("id, name, started_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  state.timers = data || [];
  renderTimers();
  startDisplayInterval();
  showMessage("");
}

async function createTimer(name) {
  const timerName = name.trim() || "Timer";
  showMessage("Creating timer...");
  const { error } = await supabaseClient.from("timers").insert({
    name: timerName,
    user_id: state.session.user.id,
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  await fetchTimers();
}

async function restartTimer(id) {
  showMessage("Restarting timer...");
  const { error } = await supabaseClient
    .from("timers")
    .update({ started_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  await fetchTimers();
}

async function renameTimer(id, currentName) {
  const nextName = window.prompt("edit the name:", currentName);
  if (nextName === null) {
    return;
  }

  const timerName = nextName.trim() || "Timer";
  showMessage("Updating timer...");
  const { error } = await supabaseClient
    .from("timers")
    .update({ name: timerName })
    .eq("id", id);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  await fetchTimers();
}

async function deleteTimer(id) {
  showMessage("Deleting timer...");
  const { error } = await supabaseClient.from("timers").delete().eq("id", id);

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  await fetchTimers();
}

createTimerButton.addEventListener("click", async () => {
  const name = window.prompt("write a name:", "Timer");
  if (name === null) {
    return;
  }

  await createTimer(name);
});

timersList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const card = button.closest("[data-id]");
  const id = card?.getAttribute("data-id");
  if (!id) {
    return;
  }

  if (button.dataset.action === "restart") {
    await restartTimer(id);
  }

  if (button.dataset.action === "rename") {
    await renameTimer(id, button.textContent || "Timer");
  }

  if (button.dataset.action === "delete") {
    await deleteTimer(id);
  }
});

signOutButton.addEventListener("click", async () => {
  showMessage("Signing out...");
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  window.location.href = "signin.html";
});

async function initializeTimerPage() {
  if (!requireSupabase()) {
    return;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session?.user) {
    window.location.href = "signin.html";
    return;
  }

  state.session = session;
  userEmail.textContent = session.user.email;
  await fetchTimers();

  supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
    if (!nextSession?.user) {
      window.location.href = "signin.html";
    }
  });
}

initializeTimerPage();
