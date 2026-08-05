(() => {
  const APP_VERSION = "ios-20260804-7";
  const configKey = "meps-config-v1";
  const defaults = {
    url: "https://blycesggrrjzeubkxdaw.supabase.co",
    anonKey: "sb_publishable_WCnVFsoLVsUnBluz6hGIHA_2tTO6FXG"
  };

  try {
    const current = JSON.parse(localStorage.getItem(configKey) || "null") || {};
    if (!current.url || !current.anonKey) {
      localStorage.setItem(configKey, JSON.stringify({
        ...current,
        url: current.url || defaults.url,
        anonKey: current.anonKey || defaults.anonKey
      }));
    }
  } catch {
    localStorage.setItem(configKey, JSON.stringify(defaults));
  }

  const style = document.createElement("link");
  style.rel = "stylesheet";
  style.href = `ios-overrides.css?v=${APP_VERSION}`;
  document.head.appendChild(style);

  const files = ["app-core.js", "app-sync.js", "pin-ui.js", "app-main.js"];
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${src}?v=${APP_VERSION}`;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });

  files.reduce((chain, file) => chain.then(() => load(file)), Promise.resolve())
    .catch((error) => {
      console.error(error);
      const toast = document.getElementById("toast");
      if (toast) {
        toast.textContent = "The app could not finish loading. Reconnect and refresh.";
        toast.classList.add("show");
      }
    });
})();