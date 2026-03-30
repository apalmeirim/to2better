const resetForm = document.querySelector("#reset-form");

async function initializeResetPage() {
  if (!requireSupabase()) {
    return;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    showMessage("Set a new password for your account.");
    return;
  }

  showMessage("Open this page from your password reset email.", "error");
}

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireSupabase()) {
    return;
  }

  const formData = new FormData(resetForm);
  const password = String(formData.get("password") || "");

  showMessage("Updating password...");
  const { error } = await supabaseClient.auth.updateUser({ password });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  resetForm.reset();
  showMessage("Password updated. You can return to sign in.");
});

initializeResetPage();
