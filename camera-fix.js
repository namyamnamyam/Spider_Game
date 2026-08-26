(() => {
  "use strict";

  const scene = BABYLON.EngineStore.LastCreatedScene;
  if (!scene) return;

  const camera = scene.activeCamera;
  const player = scene.getMeshByName("player");
  const canvas = document.getElementById("renderCanvas");
  if (!(camera instanceof BABYLON.ArcRotateCamera) || !player || !canvas) return;

  const settingsBtn = document.getElementById("settingsBtn");
  const settingsOverlay = document.getElementById("settingsOverlay");
  const settingsCloseBtn = document.getElementById("settingsCloseBtn");
  const distanceSlider = document.getElementById("cameraDistanceSlider");
  const distanceValue = document.getElementById("cameraDistanceValue");
  const distanceLockInput = document.getElementById("cameraDistanceLock");

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const STORAGE_KEY = "spiderGame.settings.v1";

  let savedSettings = {};
  try {
    savedSettings = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (_) {
    savedSettings = {};
  }

  // game.js follows the player by replacing camera.target every frame.
  // Keep the chosen look angles separately and restore them after follow.
  camera.detachControl(canvas);
  camera.lowerBetaLimit = 0.18;
  camera.upperBetaLimit = 2.62;
  camera.lowerRadiusLimit = 4.5;
  camera.upperRadiusLimit = 18;

  let desiredAlpha = camera.alpha;
  let desiredBeta = camera.beta;
  let desiredRadius = clamp(
    Number.isFinite(Number(savedSettings.cameraDistance))
      ? Number(savedSettings.cameraDistance)
      : camera.radius,
    camera.lowerRadiusLimit,
    camera.upperRadiusLimit
  );
  let distanceLocked = savedSettings.cameraDistanceLocked !== false;
  let settingsOpen = false;

  camera.radius = desiredRadius;

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cameraDistance: Number(desiredRadius.toFixed(1)),
        cameraDistanceLocked: distanceLocked,
      }));
    } catch (_) {}
  }

  function syncDistanceUi() {
    if (distanceSlider) distanceSlider.value = desiredRadius.toFixed(1);
    if (distanceValue) distanceValue.textContent = desiredRadius.toFixed(1);
    if (distanceLockInput) distanceLockInput.checked = distanceLocked;
  }

  syncDistanceUi();

  function setSettingsOpen(open) {
    settingsOpen = Boolean(open);
    if (!settingsOverlay) return;
    settingsOverlay.classList.toggle("open", settingsOpen);
    settingsOverlay.setAttribute("aria-hidden", settingsOpen ? "false" : "true");
    if (settingsOpen) {
      lookPointer = null;
      syncDistanceUi();
    }
  }

  settingsBtn?.addEventListener("click", () => setSettingsOpen(true));
  settingsCloseBtn?.addEventListener("click", () => setSettingsOpen(false));
  settingsOverlay?.addEventListener("pointerdown", (event) => {
    if (event.target === settingsOverlay) setSettingsOpen(false);
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && settingsOpen) setSettingsOpen(false);
  });

  distanceSlider?.addEventListener("input", () => {
    desiredRadius = clamp(
      Number(distanceSlider.value),
      camera.lowerRadiusLimit,
      camera.upperRadiusLimit
    );
    camera.radius = desiredRadius;
    syncDistanceUi();
    saveSettings();
  });

  distanceLockInput?.addEventListener("change", () => {
    distanceLocked = distanceLockInput.checked;
    desiredRadius = clamp(camera.radius, camera.lowerRadiusLimit, camera.upperRadiusLimit);
    syncDistanceUi();
    saveSettings();
  });

  let lookPointer = null;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (event) => {
    if (settingsOpen) return;
    // Right mouse stays reserved for hold-to-swing in game.js.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (lookPointer !== null) return;

    lookPointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    try { canvas.setPointerCapture(event.pointerId); } catch (_) {}
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener("pointermove", (event) => {
    if (settingsOpen || event.pointerId !== lookPointer) return;

    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    desiredAlpha -= dx * 0.0062;
    // Swipe UP => beta increases past PI/2 => camera looks upward.
    desiredBeta = clamp(
      desiredBeta - dy * 0.0062,
      camera.lowerBetaLimit,
      camera.upperBetaLimit
    );

    camera.alpha = desiredAlpha;
    camera.beta = desiredBeta;
    event.preventDefault();
  }, { passive: false });

  const endLook = (event) => {
    if (event.pointerId !== lookPointer) return;
    lookPointer = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
  };

  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);

  // On desktop, unlocked distance can also be changed with the wheel.
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    if (distanceLocked || settingsOpen) return;

    desiredRadius = clamp(
      camera.radius + event.deltaY * 0.01,
      camera.lowerRadiusLimit,
      camera.upperRadiusLimit
    );
    camera.radius = desiredRadius;
    syncDistanceUi();
    saveSettings();
  }, { passive: false });

  // Registered after game.js, so this runs after game.js camera-follow code.
  scene.onBeforeRenderObservable.add(() => {
    camera.alpha = desiredAlpha;
    camera.beta = desiredBeta;

    if (distanceLocked) {
      camera.radius = desiredRadius;
    } else {
      desiredRadius = clamp(camera.radius, camera.lowerRadiusLimit, camera.upperRadiusLimit);
    }

    // Looking above the horizon puts an ArcRotate camera below its target.
    // Lift the target enough to keep the camera above street level.
    const lookUpAmount = Math.max(0, desiredBeta - 1.48);
    if (lookUpAmount > 0) {
      camera.target.y = player.position.y + 1.05 + lookUpAmount * camera.radius * 0.92;
    }
  });
})();
