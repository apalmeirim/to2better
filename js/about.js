const aboutBackLink = document.querySelector("#about-back-link");

(async function initializeAboutPage() {
  if (!requireSupabase() || !aboutBackLink) {
    return;
  }

  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  aboutBackLink.href = session?.user ? "account.html" : "index.html";
})();
