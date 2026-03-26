const signupForm = document.querySelector("#signup-form");

async function initializeSignUpPage() {
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

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!requireSupabase()) {
    return;
  }

  const formData = new FormData(signupForm);
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  showMessage("Creating account...");
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });

  if (error) {
    showMessage(error.message, "error");
    return;
  }

  signupForm.reset();

  if (data.session?.user) {
    window.location.href = "timer.html";
    return;
  }

  showMessage("Account created. Check your email if confirmation is enabled, then sign in.");
});

initializeSignUpPage();
