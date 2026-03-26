const SUPABASE_URL = "https://pjbopcwzzvlumnamviks.supabase.co";
const SUPABASE_KEY = "sb_publishable_yU7gZNYwVsIspKEU1GHdCw_pI5V_fnp";

const hasSupabaseConfig =
  SUPABASE_URL !== "PASTE_SUPABASE_URL_HERE" &&
  SUPABASE_KEY !== "PASTE_SUPABASE_ANON_KEY_HERE";

const { createClient } = window.supabase;
const supabaseClient = hasSupabaseConfig ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function showMessage(text, type = "info") {
  const messageBox = document.querySelector("#message");
  if (!messageBox) {
    return;
  }

  if (!text) {
    messageBox.textContent = "";
    messageBox.className = "message hidden";
    return;
  }

  messageBox.textContent = text;
  messageBox.className = `message ${type === "error" ? "error" : ""}`;
}

function requireSupabase() {
  if (!supabaseClient) {
    showMessage("Paste your Supabase URL and anon key into js/supabase-client.js before using the app.", "error");
    return false;
  }

  return true;
}
