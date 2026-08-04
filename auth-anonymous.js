"use strict";

async function ensureAnonymousSession() {
  if (session?.access_token) return session;
  if (!config.url || !config.anonKey) throw new Error("Supabase is not configured");

  const message = document.getElementById("teamMessage");
  if (message) message.textContent = "Connecting this device…";

  try {
    const response = await fetch(`${config.url.replace(/\/$/, "")}/auth/v1/signup`, {
      method: "POST",
      cache: "no-store",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ data: { device_type: "meps-pwa" } })
    });

    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

    if (!response.ok) {
      const detail = data?.msg || data?.message || data?.error_description || raw || `HTTP ${response.status}`;
      throw new Error(detail);
    }
    if (!data?.access_token) throw new Error("Supabase did not return an anonymous session");

    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
      user: data.user || null
    };
    localStorage.setItem(SESSION, JSON.stringify(session));
    if (message) message.textContent = "Device connected. Create or join a team.";
    renderSettings();
    return session;
  } catch (error) {
    console.error("Anonymous session failed", error);
    const detail = String(error?.message || error || "Unknown authentication error");
    if (message) message.textContent = `Device connection failed: ${detail}`;
    throw error;
  }
}

(() => {
  const authCard = document.getElementById("authCard");
  if (authCard) authCard.classList.add("hidden");

  const teamCard = document.getElementById("teamCard");
  if (teamCard) {
    const intro = document.createElement("div");
    intro.className = "settings-copy anonymous-intro";
    intro.innerHTML = "<strong>No account needed</strong><p>This device connects automatically. Enter your name, then create a team or join with the shared code.</p>";
    teamCard.prepend(intro);
  }

  const advanced = document.querySelector(".advanced-settings");
  if (advanced) {
    const note = document.createElement("p");
    note.className = "muted";
    note.textContent = "Email/password recovery is optional and can be added later.";
    advanced.appendChild(note);
  }
})();