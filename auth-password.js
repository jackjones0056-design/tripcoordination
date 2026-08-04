"use strict";

(() => {
  const authCard = document.getElementById("authCard");
  const emailInput = document.getElementById("authEmail");
  const magicLinkButton = document.getElementById("sendEmailLink");
  const signOutButton = document.getElementById("signOut");
  const authMessage = document.getElementById("authMessage");

  if (!authCard || !emailInput || !magicLinkButton || !signOutButton || !authMessage) return;

  const form = emailInput.closest(".settings-form") || emailInput.parentElement;
  const passwordInput = document.createElement("input");
  passwordInput.id = "authPassword";
  passwordInput.type = "password";
  passwordInput.autocomplete = "current-password";
  passwordInput.placeholder = "Password (8+ characters)";
  passwordInput.minLength = 8;

  const passwordActions = document.createElement("div");
  passwordActions.className = "password-actions";
  passwordActions.innerHTML = `
    <button id="signInPassword" class="button" type="button">Sign in</button>
    <button id="signUpPassword" class="button secondary" type="button">Create account</button>
  `;

  const setPasswordButton = document.createElement("button");
  setPasswordButton.id = "setPassword";
  setPasswordButton.type = "button";
  setPasswordButton.className = "button secondary hidden";
  setPasswordButton.textContent = "Set or change password";

  form.insertBefore(passwordInput, magicLinkButton);
  form.insertBefore(passwordActions, magicLinkButton);
  form.insertBefore(setPasswordButton, magicLinkButton);
  magicLinkButton.textContent = "Email me a sign-in link instead";
  magicLinkButton.classList.add("secondary");

  const style = document.createElement("style");
  style.textContent = `
    .password-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    #authPassword{font-size:16px}
    @media(max-width:380px){.password-actions{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const normalizeEmail = () => emailInput.value.trim().toLowerCase();
  const password = () => passwordInput.value;
  const validPassword = value => typeof value === "string" && value.length >= 8;

  function storeSession(data) {
    if (!data?.access_token) return false;
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
      user: data.user || null
    };
    localStorage.setItem(SESSION, JSON.stringify(session));
    return true;
  }

  async function finishSignIn(data, message) {
    if (!storeSession(data)) throw new Error("No session was returned.");
    passwordInput.value = "";
    await fetchUser();
    await resolveTeam();
    render();
    toast(message);
  }

  async function signInWithPassword() {
    const email = normalizeEmail();
    const pass = password();
    if (!validEmail(email)) return toast("Enter a valid email address");
    if (!validPassword(pass)) return toast("Password must be at least 8 characters");
    try {
      const data = await api("/auth/v1/token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password: pass })
      });
      await finishSignIn(data, "Signed in");
    } catch (error) {
      console.error(error);
      authMessage.textContent = "Email or password is incorrect, or the email has not been verified.";
    }
  }

  async function signUpWithPassword() {
    const email = normalizeEmail();
    const pass = password();
    if (!validEmail(email)) return toast("Enter a valid email address");
    if (!validPassword(pass)) return toast("Password must be at least 8 characters");
    const redirectTo = new URL("./", location.href).href;
    try {
      const data = await api(`/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`, {
        method: "POST",
        body: JSON.stringify({ email, password: pass })
      });
      if (data?.access_token) {
        await finishSignIn(data, "Account created");
      } else {
        passwordInput.value = "";
        authMessage.textContent = `Account created. Check ${email} once to verify it, then use your password from then on.`;
        toast("Verification email sent");
      }
    } catch (error) {
      console.error(error);
      authMessage.textContent = "Could not create the account. The email may already be registered.";
    }
  }

  async function setOrChangePassword() {
    const pass = password();
    if (!session?.access_token) return toast("Sign in first");
    if (!validPassword(pass)) return toast("Password must be at least 8 characters");
    try {
      await api("/auth/v1/user", {
        method: "PUT",
        body: JSON.stringify({ password: pass })
      });
      passwordInput.value = "";
      authMessage.textContent = "Password saved. You can use it the next time you sign in.";
      toast("Password updated");
    } catch (error) {
      console.error(error);
      authMessage.textContent = "Could not update the password. Reopen your verification link and try again.";
    }
  }

  document.getElementById("signInPassword").addEventListener("click", signInWithPassword);
  document.getElementById("signUpPassword").addEventListener("click", signUpWithPassword);
  setPasswordButton.addEventListener("click", setOrChangePassword);
  passwordInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !session?.access_token) signInWithPassword();
  });

  const previousRenderSettings = renderSettings;
  renderSettings = function renderSettingsWithPassword() {
    previousRenderSettings();
    const signedIn = Boolean(session?.access_token);
    passwordActions.classList.toggle("hidden", signedIn);
    setPasswordButton.classList.toggle("hidden", !signedIn);
    passwordInput.classList.remove("hidden");
    passwordInput.autocomplete = signedIn ? "new-password" : "current-password";
    passwordInput.placeholder = signedIn ? "New password (8+ characters)" : "Password (8+ characters)";
    magicLinkButton.classList.toggle("hidden", signedIn);
    if (signedIn && session?.user?.email) emailInput.value = session.user.email;
  };

  renderSettings();
})();
