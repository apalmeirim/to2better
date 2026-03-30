const state = {
  session: null,
  profile: null,
  onboardingStep: 0,
};

const onboardingPanel = document.querySelector("#onboarding-panel");
const pageContent = document.querySelector("#page-content");
const onboardingForm = document.querySelector("#onboarding-form");
const onboardingSteps = Array.from(document.querySelectorAll(".onboarding-step"));
const onboardingStepIndicator = document.querySelector("#onboarding-step-indicator");
const onboardingBackButton = document.querySelector("#onboarding-back-button");
const onboardingNextButton = document.querySelector("#onboarding-next-button");
const onboardingSubmitButton = document.querySelector("#onboarding-submit-button");

function focusOnboardingStep() {
  onboardingSteps[state.onboardingStep]?.querySelector("textarea, input")?.focus();
}

function renderOnboardingStep() {
  onboardingSteps.forEach((step, index) => {
    step.classList.toggle("hidden", index !== state.onboardingStep);
  });

  onboardingStepIndicator.textContent = `${state.onboardingStep + 1} / ${onboardingSteps.length}`;
  onboardingNextButton.classList.toggle("hidden", state.onboardingStep === onboardingSteps.length - 1);
  onboardingSubmitButton.classList.toggle("hidden", state.onboardingStep !== onboardingSteps.length - 1);
  focusOnboardingStep();
}

function validateOnboardingStep(stepIndex) {
  if (stepIndex === 0 && BetterApp.parseList(document.querySelector("#stop-items").value).length < 2) {
    showMessage("List at least two items for what you want to stop.", "error");
    return false;
  }

  if (stepIndex === 1 && BetterApp.parseList(document.querySelector("#start-items").value).length < 2) {
    showMessage("List at least two items for what you want to start.", "error");
    return false;
  }

  if (stepIndex === 2 && !String(document.querySelector("#week-word").value || "").trim()) {
    showMessage("Add one word for your week.", "error");
    return false;
  }

  if (stepIndex === 3 && !String(document.querySelector("#month-word").value || "").trim()) {
    showMessage("Add one word for your month.", "error");
    return false;
  }

  showMessage("");
  return true;
}

async function submitOnboarding(event) {
  event.preventDefault();

  if (!validateOnboardingStep(state.onboardingStep)) {
    return;
  }

  const stopItems = BetterApp.parseList(document.querySelector("#stop-items").value);
  const startItems = BetterApp.parseList(document.querySelector("#start-items").value);
  const weekWord = String(document.querySelector("#week-word").value || "").trim();
  const monthWord = String(document.querySelector("#month-word").value || "").trim();
  const userId = state.session.user.id;
  const now = new Date().toISOString();

  showMessage("Saving your first setup...");

  const { data: insertedFocusItems, error: focusError } = await supabaseClient
    .from("focus_items")
    .insert([
      ...stopItems.map((name) => ({ user_id: userId, kind: "stop", name })),
      ...startItems.map((name) => ({ user_id: userId, kind: "start", name })),
    ])
    .select("id, kind, name");

  if (focusError) {
    showMessage(focusError.message, "error");
    return;
  }

  const stopRows = (insertedFocusItems || []).filter((item) => item.kind === "stop");
  const startRows = (insertedFocusItems || []).filter((item) => item.kind === "start");

  if (stopRows.length) {
    const { error } = await supabaseClient.from("timers").insert(
      stopRows.map((item) => ({
        user_id: userId,
        focus_item_id: item.id,
        name: item.name,
      }))
    );

    if (error) {
      showMessage(error.message, "error");
      return;
    }
  }

  if (startRows.length) {
    const { error } = await supabaseClient.from("grow_tasks").insert(
      startRows.map((item) => ({
        user_id: userId,
        title: item.name,
      }))
    );

    if (error) {
      showMessage(error.message, "error");
      return;
    }
  }

  const weekStart = BetterApp.toDateKey(BetterApp.startOfWeek());
  const monthStart = BetterApp.toDateKey(BetterApp.startOfMonth());

  const [{ error: weeklyError }, { error: monthlyError }, { data: profileData, error: profileError }] = await Promise.all([
    supabaseClient.from("weekly_reflects").upsert(
      {
        user_id: userId,
        week_start: weekStart,
        word: weekWord,
        updated_at: now,
      },
      { onConflict: "user_id,week_start" }
    ),
    supabaseClient.from("monthly_chapters").upsert(
      {
        user_id: userId,
        month_start: monthStart,
        word: monthWord,
        updated_at: now,
      },
      { onConflict: "user_id,month_start" }
    ),
    supabaseClient
      .from("profiles")
      .update({ onboarded_at: now, updated_at: now })
      .eq("user_id", userId)
      .select("user_id, email, onboarded_at, created_at, updated_at")
      .single(),
  ]);

  const firstError = weeklyError || monthlyError || profileError;
  if (firstError) {
    showMessage(firstError.message, "error");
    return;
  }

  state.profile = profileData;
  onboardingForm.reset();
  renderPage();
}

function renderPage() {
  const onboarded = Boolean(state.profile?.onboarded_at);
  onboardingPanel.classList.toggle("hidden", onboarded);
  pageContent.classList.toggle("hidden", !onboarded);

  if (!onboarded) {
    renderOnboardingStep();
  } else {
    showMessage("");
  }
}

onboardingBackButton?.addEventListener("click", () => {
  if (state.onboardingStep === 0) {
    window.location.href = "signin.html";
    return;
  }

  state.onboardingStep -= 1;
  showMessage("");
  renderOnboardingStep();
});

onboardingNextButton?.addEventListener("click", () => {
  if (!validateOnboardingStep(state.onboardingStep)) {
    return;
  }

  if (state.onboardingStep < onboardingSteps.length - 1) {
    state.onboardingStep += 1;
    renderOnboardingStep();
  }
});

onboardingForm?.addEventListener("submit", submitOnboarding);

(async function initializeHomePage() {
  try {
    showMessage("Loading to2better...");
    const app = await BetterApp.initializeShell({ allowUnonboarded: true });
    if (!app) {
      return;
    }

    state.session = app.session;
    state.profile = app.profile;
    renderPage();
  } catch (error) {
    showMessage(error.message || "Unable to load to2better.", "error");
  }
})();
