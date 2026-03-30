const settingsState = {
  session: null,
};

const resetPasswordButton = document.querySelector("#reset-password-button");
const resetDataButton = document.querySelector("#reset-data-button");
const deleteAccountButton = document.querySelector("#delete-account-button");

async function resetAllData() {
  const userId = settingsState.session.user.id;
  const now = new Date().toISOString();

  const operations = [
    supabaseClient.from("weekly_reflects").delete().eq("user_id", userId),
    supabaseClient.from("monthly_chapters").delete().eq("user_id", userId),
    supabaseClient.from("grow_tasks").delete().eq("user_id", userId),
    supabaseClient.from("timers").delete().eq("user_id", userId),
    supabaseClient.from("focus_items").delete().eq("user_id", userId),
    supabaseClient.from("profiles").update({ onboarded_at: null, updated_at: now }).eq("user_id", userId),
  ];

  const results = await Promise.all(operations);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw failed.error;
  }
}

resetPasswordButton?.addEventListener("click", async () => {
  try {
    showMessage("Sending password reset...");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(settingsState.session.user.email, {
      redirectTo: `${window.location.origin}/reset.html`,
    });

    if (error) {
      throw error;
    }

    showMessage("Password reset email sent.");
  } catch (error) {
    showMessage(error.message, "error");
  }
});

resetDataButton?.addEventListener("click", async () => {
  const confirmed = window.confirm("Reset all app data and go back to first login?");
  if (!confirmed) {
    return;
  }

  try {
    showMessage("Resetting all app data...");
    await resetAllData();
    window.location.href = "timer.html";
  } catch (error) {
    showMessage(error.message, "error");
  }
});

deleteAccountButton?.addEventListener("click", () => {
  void (async () => {
    const confirmed = window.confirm("Delete your account permanently?");
    if (!confirmed) {
      return;
    }

    try {
      showMessage("Deleting account...");
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session?.access_token) {
        throw new Error("You are not signed in.");
      }

      const { error } = await supabaseClient.functions.invoke("smooth-handler", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        throw error;
      }

      await supabaseClient.auth.signOut();
      window.location.href = "index.html";
    } catch (error) {
      showMessage(error.message || "Unable to delete account.", "error");
    }
  })();
});

(async function initializeSettingsPage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell();
    if (!app) {
      return;
    }

    settingsState.session = app.session;
    document.querySelector("#account-email").textContent = app.session.user.email;
    showMessage("");
  } catch (error) {
    showMessage(error.message || "Unable to load settings.", "error");
  }
})();
