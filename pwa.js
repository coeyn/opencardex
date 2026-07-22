(function () {
  const updateBanner = document.createElement("div");
  updateBanner.className = "update-banner";
  updateBanner.hidden = true;
  updateBanner.innerHTML = `
    <span>Une nouvelle version d'OpenCardex est disponible.</span>
    <button type="button" class="primary-button">Recharger</button>
  `;
  document.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(updateBanner);
  });

  function showUpdateBanner(worker) {
    updateBanner.hidden = false;
    updateBanner.querySelector("button").onclick = () => {
      worker?.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    };
  }

  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("sw.js");
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            showUpdateBanner(worker);
          }
        });
      });
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  });
})();
