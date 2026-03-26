const signinForm = document.querySelector("#signin-form");

async function initializeSignInPage() {
  if (!requireSupabase()) {
    return;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (session?.user) {
    window.location.href = "timer.html";
  }
}

signinForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireSupabase()) {
    return;
  }

  const formData = new FormData(signinForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  showMessage("Signing in...");
  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  window.location.href = "timer.html";
});

initializeSignInPage();
