(() => {
  "use strict";

  const scene = BABYLON.EngineStore.LastCreatedScene;
  if (!scene) return;

  const camera = scene.activeCamera;
  const player = scene.getMeshByName("player");
  if (!(camera instanceof BABYLON.ArcRotateCamera) || !player) return;

  // v0.1 had upperBetaLimit below PI / 2, so the camera physically
  // could not rotate far enough to look above the horizon.
  camera.lowerBetaLimit = 0.24;
  camera.upperBetaLimit = 2.45;
  camera.angularSensibilityX = 760;
  camera.angularSensibilityY = 700;

  // When an ArcRotateCamera looks high upward it normally orbits below its
  // target. Lift the target while looking up so the camera does not dive
  // underground and the player can still aim at rooftops / the sky.
  scene.onBeforeRenderObservable.add(() => {
    const lookUp = Math.max(0, camera.beta - 1.47);
    if (lookUp <= 0.001) return;

    const lift = lookUp * camera.radius * 0.85;
    camera.target.y = player.position.y + 1.05 + lift;
  });
})();
