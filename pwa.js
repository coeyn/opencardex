(function () {
  let refreshing = false;
  let waitingWorker = null;

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
    waitingWorker = worker || waitingWorker;
    updateBanner.hidden = false;
    updateBanner.querySelector("button").onclick = () => {
      waitingWorker?.postMessage({ type: "SKIP_WAITING" });
    };
  }

  function activateUpdate(worker) {
    waitingWorker = worker || waitingWorker;
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    }
  }

  function watchInstallingWorker(worker, { autoActivate = false } = {}) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdateBanner(worker);
        if (autoActivate) {
          activateUpdate(worker);
        }
      }
    });
  }

  if (!("serviceWorker" in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("sw.js");
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration.waiting);
        activateUpdate(registration.waiting);
      }
      registration.update();
      registration.addEventListener("updatefound", () => {
        watchInstallingWorker(registration.installing, { autoActivate: true });
      });
      window.setInterval(() => {
        registration.update();
      }, 30 * 60 * 1000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") {
          registration.update();
        }
      });
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  });
})();
