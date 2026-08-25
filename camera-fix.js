(() => {
  "use strict";

  const scene = BABYLON.EngineStore.LastCreatedScene;
  if (!scene) return;

  const camera = scene.activeCamera;
  const player = scene.getMeshByName("player");
  const canvas = document.getElementById("renderCanvas");
  if (!(camera instanceof BABYLON.ArcRotateCamera) || !player || !canvas) return;

  // Babylon's default ArcRotate touch input was unreliable on iPad while a
  // second pointer is being used by the movement joystick. Replace it with a
  // tiny explicit look controller so the right side of the screen always works.
  camera.detachControl(canvas);
  camera.lowerBetaLimit = 0.18;
  camera.upperBetaLimit = 2.62;

  let lookPointer = null;
  let lastX = 0;
  let lastY = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  canvas.addEventListener("pointerdown", (event) => {
    // Keep right mouse button free for the hold-to-swing control in game.js.
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

    // Swipe left/right = yaw. Swipe UP = look UP.
    camera.alpha -= dx * 0.0062;
    camera.beta = clamp(camera.beta - dy * 0.0062, camera.lowerBetaLimit, camera.upperBetaLimit);
    event.preventDefault();
  }, { passive: false });

  const endLook = (event) => {
    if (event.pointerId !== lookPointer) return;
    lookPointer = null;
    try { canvas.releasePointerCapture(event.pointerId); } catch (_) {}
  };

  canvas.addEventListener("pointerup", endLook);
  canvas.addEventListener("pointercancel", endLook);

  // Desktop convenience: keep mouse-wheel zoom after detaching Babylon input.
  canvas.addEventListener("wheel", (event) => {
    camera.radius = clamp(camera.radius + event.deltaY * 0.01, 5.5, 14);
    event.preventDefault();
  }, { passive: false });

  // ArcRotate cameras normally descend below their target when beta passes
  // the horizon. Raise the follow target while looking upward so the camera
  // stays above the street while still allowing a real skyward aim angle.
  scene.onBeforeRenderObservable.add(() => {
    const lookUpAmount = Math.max(0, camera.beta - 1.42);
    if (lookUpAmount > 0) {
      camera.target.y = player.position.y + 1.05 + lookUpAmount * camera.radius * 0.98;
    }
  });
})();
