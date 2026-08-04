(() => {
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
