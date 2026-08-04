(() => {
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

  const files = ["app-core.js", "app-sync.js", "app-main.js"];
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
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
