(async function initializeAccountPage() {
  try {
    showMessage("Loading to2better...");
    await BetterApp.initializeShell();
    showMessage("");
  } catch (error) {
    showMessage(error.message || "Unable to load account.", "error");
  }
})();
