(() => {
  "use strict";

  const scene = BABYLON.EngineStore.LastCreatedScene;
  if (!scene) return;

  const camera = scene.activeCamera;
  const player = scene.getMeshByName("player");
  const canvas = document.getElementById("renderCanvas");
  if (!(camera instanceof BABYLON.ArcRotateCamera) || !player || !canvas) return;

  // game.js follows the player by replacing camera.target every frame.
  // ArcRotateCamera recalculates alpha/beta when that happens, which used to
  // pull the view back toward the horizon like a spring. Keep the player's
  // chosen look angles separately and restore them after the follow update.
  camera.detachControl(canvas);
  camera.lowerBetaLimit = 0.18;
  camera.upperBetaLimit = 2.62;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let desiredAlpha = camera.alpha;
  let desiredBeta = camera.beta;
  let lookPointer = null;
  let lastX = 0;
  let lastY = 0;

  canvas.addEventListener("pointerdown", (event) => {
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
    if (event.pointerId !== lookPointer) return;

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

  canvas.addEventListener("wheel", (event) => {
    camera.radius = clamp(camera.radius + event.deltaY * 0.01, 5.5, 14);
    event.preventDefault();
  }, { passive: false });

  // This observer is registered after game.js, so it runs after game.js's
  // camera-follow code. Restore the exact view chosen by the player every
  // frame, preventing target-follow from changing the pitch/yaw.
  scene.onBeforeRenderObservable.add(() => {
    camera.alpha = desiredAlpha;
    camera.beta = desiredBeta;

    // Looking above the horizon puts an ArcRotate camera below its target.
    // Lift the target enough to keep the camera above street level without
    // changing the chosen pitch.
    const lookUpAmount = Math.max(0, desiredBeta - 1.48);
    if (lookUpAmount > 0) {
      camera.target.y = player.position.y + 1.05 + lookUpAmount * camera.radius * 0.92;
    }
  });
})();
