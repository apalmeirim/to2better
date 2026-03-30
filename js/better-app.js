const BetterApp = (() => {
  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
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

  function formatShortDate(value) {
    return new Date(value).toLocaleDateString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function toDateKey(value = new Date()) {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseList(value) {
    return String(value)
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function startOfWeek(value = new Date()) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  function startOfMonth(value = new Date()) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    date.setDate(1);
    return date;
  }

  function addDays(value, amount) {
    const date = new Date(value);
    date.setDate(date.getDate() + amount);
    return date;
  }

  function monthLabel(monthKey) {
    return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString([], {
      year: "numeric",
      month: "long",
    });
  }

  function weekRangeLabel(weekStart) {
    const start = new Date(`${weekStart}T00:00:00`);
    const end = addDays(start, 6);
    return `${formatShortDate(start)} - ${formatShortDate(end)}`;
  }

  function isReflectionUnlocked(weekStart) {
    const unlockDate = addDays(new Date(`${weekStart}T00:00:00`), 7);
    return Date.now() >= unlockDate.getTime();
  }

  function computeTaskStreak(logs, taskId) {
    const completedDays = logs
      .filter((log) => log.task_id === taskId && log.completed)
      .map((log) => log.log_date);

    if (!completedDays.length) {
      return 0;
    }

    const completedSet = new Set(completedDays);
    const today = new Date();
    const todayKey = toDateKey(today);
    const yesterdayKey = toDateKey(addDays(today, -1));
    let cursor = completedSet.has(todayKey) ? new Date(today) : completedSet.has(yesterdayKey) ? addDays(today, -1) : null;

    if (!cursor) {
      return 0;
    }

    let streak = 0;
    while (completedSet.has(toDateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }

    return streak;
  }

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

    return `${weeks}w ${days}d ${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  async function requireSession() {
    if (!requireSupabase()) {
      return null;
    }

    const {
      data: { session },
    } = await supabaseClient.auth.getSession();

    if (!session?.user) {
      window.location.href = "signin.html";
      return null;
    }

    return session;
  }

  async function ensureProfile(user) {
    const { data, error } = await supabaseClient
      .from("profiles")
      .upsert(
        {
          user_id: user.id,
          email: user.email,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select("user_id, email, onboarded_at, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function initializeShell({ allowUnonboarded = false } = {}) {
    const session = await requireSession();
    if (!session) {
      return null;
    }

    const profile = await ensureProfile(session.user);
    const onboarded = Boolean(profile.onboarded_at);
    if (!allowUnonboarded && !onboarded) {
      window.location.href = "timer.html";
      return null;
    }

    document.querySelectorAll("#user-email, #account-email").forEach((node) => {
      node.textContent = session.user.email;
    });

    const signOutButton = document.querySelector("#sign-out-button");
    signOutButton?.addEventListener("click", async () => {
      showMessage("Signing out...");
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        showMessage(error.message, "error");
        return;
      }
      window.location.href = "signin.html";
    });

    const backButton = document.querySelector("#back-button");
    backButton?.addEventListener("click", () => {
      window.location.href = backButton.dataset.backHref || "timer.html";
    });

    supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession?.user) {
        window.location.href = "signin.html";
      }
    });

    return { session, profile };
  }

  async function fetchTimers() {
    const { data, error } = await supabaseClient
      .from("timers")
      .select("id, focus_item_id, name, started_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function fetchTimerResets(userId) {
    const { data, error } = await supabaseClient
      .from("timer_resets")
      .select("id, timer_id, reset_at, previous_started_at, timers(name)")
      .eq("user_id", userId)
      .order("reset_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []).map((item) => ({
      ...item,
      timer_name: item.timers?.name || "Timer",
    }));
  }

  async function fetchGrowthTasks() {
    const { data, error } = await supabaseClient
      .from("growth_tasks")
      .select("id, title, created_at, archived_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function fetchGrowthLogs() {
    const { data, error } = await supabaseClient
      .from("growth_task_logs")
      .select("id, task_id, log_date, completed")
      .order("log_date", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function fetchWeeklyReflections() {
    const { data, error } = await supabaseClient
      .from("weekly_reflections")
      .select("id, week_start, word, reflection, created_at")
      .order("week_start", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async function fetchMonthlyChapters() {
    const { data, error } = await supabaseClient
      .from("monthly_chapters")
      .select("id, month_start, word, created_at")
      .order("month_start", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  }

  return {
    escapeHtml,
    formatDate,
    formatShortDate,
    toDateKey,
    parseList,
    startOfWeek,
    startOfMonth,
    addDays,
    monthLabel,
    weekRangeLabel,
    isReflectionUnlocked,
    computeTaskStreak,
    formatElapsedTime,
    initializeShell,
    ensureProfile,
    fetchTimers,
    fetchTimerResets,
    fetchGrowthTasks,
    fetchGrowthLogs,
    fetchWeeklyReflections,
    fetchMonthlyChapters,
  };
})();
