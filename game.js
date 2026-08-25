(() => {
  "use strict";

  const canvas = document.getElementById("renderCanvas");
  const statsEl = document.getElementById("stats");
  const webStateEl = document.getElementById("webState");
  const toastEl = document.getElementById("toast");
  const webBtn = document.getElementById("webBtn");
  const zipBtn = document.getElementById("zipBtn");
  const jumpBtn = document.getElementById("jumpBtn");
  const joystick = document.getElementById("joystick");
  const stick = document.getElementById("stick");

  const engine = new BABYLON.Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
    adaptToDeviceRatio: true,
  });

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.055, 0.075, 0.12, 1);
  scene.collisionsEnabled = true;
  scene.skipPointerMovePicking = true;

  const keys = Object.create(null);
  const mobileInput = { x: 0, z: 0 };
  let jumpQueued = false;
  let webAnchor = null;
  let ropeLength = 0;
  let webLine = null;
  let toastTimer = null;
  let rightWebHeld = false;

  const velocity = new BABYLON.Vector3(0, 0, 0);
  const UP = BABYLON.Vector3.Up();
  const DOWN = BABYLON.Vector3.Down();

  function material(name, hex, roughness = 0.8) {
    const mat = new BABYLON.PBRMaterial(name, scene);
    mat.albedoColor = BABYLON.Color3.FromHexString(hex);
    mat.metallic = 0.05;
    mat.roughness = roughness;
    return mat;
  }

  const groundMat = material("groundMat", "#161c27", 0.96);
  const roadMat = material("roadMat", "#0d1119", 0.98);
  const sidewalkMat = material("sidewalkMat", "#252d3a", 0.94);
  const buildingMats = [
    material("b1", "#303948", 0.82),
    material("b2", "#424b59", 0.78),
    material("b3", "#283342", 0.84),
    material("b4", "#4b4652", 0.8),
  ];
  const windowMat = new BABYLON.StandardMaterial("windowMat", scene);
  windowMat.diffuseColor = new BABYLON.Color3(0.08, 0.13, 0.2);
  windowMat.emissiveColor = new BABYLON.Color3(0.15, 0.24, 0.34);
  windowMat.alpha = 0.72;

  const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 360, height: 360 }, scene);
  ground.material = groundMat;
  ground.checkCollisions = true;
  ground.isPickable = true;
  ground.metadata = { solid: true };

  const roadWidth = 7;
  for (let i = -7; i <= 7; i++) {
    const xRoad = BABYLON.MeshBuilder.CreateBox(`roadX${i}`, {
      width: roadWidth,
      height: 0.04,
      depth: 320,
    }, scene);
    xRoad.position.set(i * 20, 0.025, 0);
    xRoad.material = roadMat;
    xRoad.isPickable = false;

    const zRoad = BABYLON.MeshBuilder.CreateBox(`roadZ${i}`, {
      width: 320,
      height: 0.045,
      depth: roadWidth,
    }, scene);
    zRoad.position.set(0, 0.03, i * 20);
    zRoad.material = roadMat;
    zRoad.isPickable = false;
  }

  let seed = 293847;
  function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  const buildings = [];
  for (let gx = -6; gx <= 6; gx++) {
    for (let gz = -6; gz <= 6; gz++) {
      if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
      if (random() < 0.12) continue;

      const width = 8.5 + random() * 4.2;
      const depth = 8.5 + random() * 4.2;
      const height = 12 + random() * 47 + (Math.abs(gx) + Math.abs(gz) > 7 ? random() * 18 : 0);
      const x = gx * 20 + (random() - 0.5) * 2.1;
      const z = gz * 20 + (random() - 0.5) * 2.1;

      const sidewalk = BABYLON.MeshBuilder.CreateBox(`walk_${gx}_${gz}`, {
        width: 15.5,
        height: 0.2,
        depth: 15.5,
      }, scene);
      sidewalk.position.set(gx * 20, 0.1, gz * 20);
      sidewalk.material = sidewalkMat;
      sidewalk.checkCollisions = true;
      sidewalk.isPickable = false;
      sidewalk.metadata = { solid: true };

      const building = BABYLON.MeshBuilder.CreateBox(`building_${gx}_${gz}`, {
        width,
        height,
        depth,
      }, scene);
      building.position.set(x, height / 2 + 0.2, z);
      building.material = buildingMats[Math.floor(random() * buildingMats.length)];
      building.checkCollisions = true;
      building.isPickable = true;
      building.metadata = { solid: true, webTarget: true };
      buildings.push(building);

      if (random() > 0.18) {
        const glass = BABYLON.MeshBuilder.CreatePlane(`glass_${gx}_${gz}`, {
          width: Math.max(4, width * 0.62),
          height: Math.max(5, height * 0.72),
        }, scene);
        glass.position.set(x, height * 0.52, z - depth / 2 - 0.015);
        glass.rotation.y = Math.PI;
        glass.material = windowMat;
        glass.isPickable = false;
      }
    }
  }

  const plaza = BABYLON.MeshBuilder.CreateCylinder("plaza", {
    diameter: 29,
    height: 0.16,
    tessellation: 48,
  }, scene);
  plaza.position.y = 0.08;
  plaza.material = sidewalkMat;
  plaza.checkCollisions = true;
  plaza.isPickable = false;
  plaza.metadata = { solid: true };

  const heroMat = material("heroMat", "#7b1221", 0.42);
  heroMat.metallic = 0.38;
  const suitMat = material("suitMat", "#111a2b", 0.52);
  suitMat.metallic = 0.3;
  const eyeMat = new BABYLON.StandardMaterial("eyeMat", scene);
  eyeMat.diffuseColor = new BABYLON.Color3(0.9, 0.95, 1);
  eyeMat.emissiveColor = new BABYLON.Color3(0.18, 0.26, 0.35);

  const player = BABYLON.MeshBuilder.CreateCapsule("player", {
    height: 2.35,
    radius: 0.52,
    tessellation: 12,
  }, scene);
  player.position.set(0, 1.25, -7);
  player.material = suitMat;
  player.checkCollisions = true;
  player.isPickable = false;
  player.ellipsoid = new BABYLON.Vector3(0.52, 1.14, 0.52);
  player.ellipsoidOffset = BABYLON.Vector3.Zero();

  const chest = BABYLON.MeshBuilder.CreateBox("chest", {
    width: 0.7,
    height: 0.82,
    depth: 0.12,
  }, scene);
  chest.parent = player;
  chest.position.set(0, 0.18, -0.47);
  chest.material = heroMat;
  chest.isPickable = false;

  const head = BABYLON.MeshBuilder.CreateSphere("head", {
    diameter: 0.84,
    segments: 16,
  }, scene);
  head.parent = player;
  head.position.y = 1.25;
  head.material = heroMat;
  head.isPickable = false;

  for (const side of [-1, 1]) {
    const eye = BABYLON.MeshBuilder.CreatePlane(`eye_${side}`, {
      width: 0.16,
      height: 0.28,
    }, scene);
    eye.parent = head;
    eye.position.set(side * 0.18, 0.04, -0.4);
    eye.rotation.z = side * -0.22;
    eye.rotation.y = Math.PI;
    eye.material = eyeMat;
    eye.isPickable = false;
  }

  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    1.12,
    9,
    player.position.add(new BABYLON.Vector3(0, 1.1, 0)),
    scene
  );
  camera.lowerRadiusLimit = 5.5;
  camera.upperRadiusLimit = 14;
  camera.lowerBetaLimit = 0.38;
  camera.upperBetaLimit = 1.48;
  camera.wheelPrecision = 30;
  camera.panningSensibility = 0;
  camera.angularSensibilityX = 820;
  camera.angularSensibilityY = 820;
  camera.attachControl(canvas, true);
  if (camera.inputs.attached.pointers) {
    camera.inputs.attached.pointers.buttons = [0];
  }

  const hemi = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0.2, 1, 0.1), scene);
  hemi.intensity = 0.78;
  hemi.groundColor = new BABYLON.Color3(0.08, 0.1, 0.15);

  const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-0.45, -1, 0.35), scene);
  sun.position = new BABYLON.Vector3(50, 90, -40);
  sun.intensity = 1.15;

  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.0045;
  scene.fogColor = new BABYLON.Color3(0.055, 0.075, 0.12);

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 950);
  }

  function aimPick(maxDistance = 145) {
    const ray = camera.getForwardRay(maxDistance);
    return scene.pickWithRay(ray, (mesh) => Boolean(mesh.metadata?.webTarget), false);
  }

  function updateWebLine() {
    if (!webAnchor) return;
    const points = [
      player.position.add(new BABYLON.Vector3(0, 0.35, 0)),
      webAnchor,
    ];

    if (!webLine) {
      webLine = BABYLON.MeshBuilder.CreateLines("webLine", { points, updatable: true }, scene);
      webLine.color = new BABYLON.Color3(0.86, 0.94, 1);
      webLine.alpha = 0.95;
      webLine.isPickable = false;
    } else {
      BABYLON.MeshBuilder.CreateLines("webLine", { points, instance: webLine });
    }
  }

  function attachWeb() {
    if (webAnchor) return true;
    const hit = aimPick();
    if (!hit?.hit || !hit.pickedPoint) {
      showToast("조준점에 웹을 붙일 건물이 없어");
      return false;
    }

    webAnchor = hit.pickedPoint.clone();
    const distance = BABYLON.Vector3.Distance(player.position, webAnchor);
    ropeLength = Math.max(5.5, distance * 0.86);
    updateWebLine();
    webStateEl.classList.add("active");
    return true;
  }

  function releaseWeb() {
    webAnchor = null;
    ropeLength = 0;
    webStateEl.classList.remove("active");
    if (webLine) {
      webLine.dispose();
      webLine = null;
    }
  }

  function toggleWeb() {
    if (webAnchor) releaseWeb();
    else attachWeb();
  }

  function webZip() {
    const hit = aimPick(110);
    if (!hit?.hit || !hit.pickedPoint) {
      showToast("ZIP 대상 없음");
      return;
    }

    releaseWeb();
    const target = hit.pickedPoint;
    const dir = target.subtract(player.position).normalize();
    velocity.copyFrom(dir.scale(39));
    velocity.y += 4.5;
    showToast("WEB ZIP");
  }

  function isGrounded() {
    const origin = player.position.add(new BABYLON.Vector3(0, 0.06, 0));
    const ray = new BABYLON.Ray(origin, DOWN, 1.38);
    const hit = scene.pickWithRay(ray, (mesh) => Boolean(mesh.metadata?.solid), false);
    return Boolean(hit?.hit && hit.distance <= 1.36);
  }

  function horizontalLength(vec) {
    return Math.hypot(vec.x, vec.z);
  }

  function capHorizontal(maxSpeed) {
    const speed = horizontalLength(velocity);
    if (speed <= maxSpeed || speed < 0.0001) return;
    const scale = maxSpeed / speed;
    velocity.x *= scale;
    velocity.z *= scale;
  }

  function getMoveInput() {
    let x = 0;
    let z = 0;
    if (keys.KeyA) x -= 1;
    if (keys.KeyD) x += 1;
    if (keys.KeyW) z += 1;
    if (keys.KeyS) z -= 1;

    x += mobileInput.x;
    z += mobileInput.z;

    const len = Math.hypot(x, z);
    if (len > 1) {
      x /= len;
      z /= len;
    }
    return { x, z, active: Math.abs(x) + Math.abs(z) > 0.04 };
  }

  function cameraBasis() {
    const forward = camera.getForwardRay().direction.clone();
    forward.y = 0;
    if (forward.lengthSquared() < 0.001) forward.set(0, 0, 1);
    forward.normalize();
    const right = BABYLON.Vector3.Cross(UP, forward).normalize();
    return { forward, right };
  }

  function updatePlayer(dt) {
    const grounded = isGrounded();
    const input = getMoveInput();
    const { forward, right } = cameraBasis();
    const desired = forward.scale(input.z).add(right.scale(input.x));
    if (desired.lengthSquared() > 1) desired.normalize();

    const accel = grounded ? 46 : webAnchor ? 14 : 18;
    if (input.active) {
      velocity.x += desired.x * accel * dt;
      velocity.z += desired.z * accel * dt;
    } else if (grounded && !webAnchor) {
      const damping = Math.exp(-9 * dt);
      velocity.x *= damping;
      velocity.z *= damping;
    }

    if (jumpQueued && grounded) {
      velocity.y = 11.8;
      jumpQueued = false;
    } else if (jumpQueued) {
      jumpQueued = false;
    }

    velocity.y -= 29.5 * dt;

    if (webAnchor) {
      const toAnchor = webAnchor.subtract(player.position);
      const distance = toAnchor.length();
      if (distance > 0.001) {
        const dir = toAnchor.scale(1 / distance);
        const stretch = Math.max(0, distance - ropeLength);
        const tension = 12 + stretch * 31;
        velocity.addInPlace(dir.scale(tension * dt));

        const radial = BABYLON.Vector3.Dot(velocity, dir);
        if (distance >= ropeLength && radial < 0) {
          velocity.subtractInPlace(dir.scale(radial * 0.94));
        }

        if (keys.ShiftLeft || keys.ShiftRight) {
          const boostDir = input.active ? desired : forward;
          velocity.addInPlace(boostDir.scale(13 * dt));
        }

        if (distance > ropeLength * 1.18) {
          ropeLength = Math.min(distance * 0.97, ropeLength + 7 * dt);
        }
      }
      capHorizontal(39);
    } else {
      capHorizontal(grounded ? 14 : 23);
    }

    const before = player.position.clone();
    player.moveWithCollisions(velocity.scale(dt));
    const actual = player.position.subtract(before);

    if (grounded && velocity.y < 0) velocity.y = 0;
    if (Math.abs(actual.x) < Math.abs(velocity.x * dt) * 0.12) velocity.x *= 0.72;
    if (Math.abs(actual.z) < Math.abs(velocity.z * dt) * 0.12) velocity.z *= 0.72;

    const faceVelocity = new BABYLON.Vector3(velocity.x, 0, velocity.z);
    if (faceVelocity.lengthSquared() > 1.2) {
      const targetYaw = Math.atan2(faceVelocity.x, faceVelocity.z);
      let delta = targetYaw - player.rotation.y;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      player.rotation.y += delta * Math.min(1, dt * 10);
    }

    if (player.position.y < -25) {
      player.position.set(0, 3, -7);
      velocity.set(0, 0, 0);
      releaseWeb();
      showToast("도시로 복귀");
    }
  }

  function updateCamera() {
    const lookAhead = new BABYLON.Vector3(velocity.x, 0, velocity.z);
    if (lookAhead.lengthSquared() > 0.01) {
      lookAhead.normalize().scaleInPlace(Math.min(1.8, horizontalLength(velocity) * 0.04));
    }
    const target = player.position.add(new BABYLON.Vector3(0, 1.05, 0)).add(lookAhead);
    camera.target = BABYLON.Vector3.Lerp(camera.target, target, 0.16);
  }

  function updateHud() {
    const speed = velocity.length();
    statsEl.textContent = `SPEED ${speed.toFixed(1)} · ALT ${Math.max(0, player.position.y - 1.2).toFixed(1)}`;
    if (webAnchor) {
      const dist = BABYLON.Vector3.Distance(player.position, webAnchor);
      webStateEl.textContent = `WEB ATTACHED · ${dist.toFixed(0)}m`;
    } else {
      webStateEl.textContent = "WEB READY";
    }
  }

  window.addEventListener("keydown", (event) => {
    keys[event.code] = true;
    if (event.code === "Space") {
      event.preventDefault();
      jumpQueued = true;
    }
    if (event.code === "KeyE" && !event.repeat) toggleWeb();
    if (event.code === "KeyF" && !event.repeat) webZip();
  });

  window.addEventListener("keyup", (event) => {
    keys[event.code] = false;
  });

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button === 2) {
      event.preventDefault();
      rightWebHeld = attachWeb();
    }
  });

  window.addEventListener("pointerup", (event) => {
    if (event.button === 2 && rightWebHeld) {
      rightWebHeld = false;
      releaseWeb();
    }
  });

  function bindButton(button, action) {
    if (!button) return;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      action();
    });
  }

  bindButton(webBtn, toggleWeb);
  bindButton(zipBtn, webZip);
  bindButton(jumpBtn, () => { jumpQueued = true; });

  if (joystick && stick) {
    let joyPointer = null;

    const updateJoystick = (event) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = event.clientX - cx;
      let dy = event.clientY - cy;
      const max = rect.width * 0.34;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      mobileInput.x = dx / max;
      mobileInput.z = -dy / max;
    };

    joystick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      joyPointer = event.pointerId;
      joystick.setPointerCapture(event.pointerId);
      updateJoystick(event);
    });

    joystick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== joyPointer) return;
      event.preventDefault();
      event.stopPropagation();
      updateJoystick(event);
    });

    const endJoystick = (event) => {
      if (event.pointerId !== joyPointer) return;
      joyPointer = null;
      mobileInput.x = 0;
      mobileInput.z = 0;
      stick.style.transform = "translate(0, 0)";
    };

    joystick.addEventListener("pointerup", endJoystick);
    joystick.addEventListener("pointercancel", endJoystick);
  }

  scene.onBeforeRenderObservable.add(() => {
    const dt = Math.min(engine.getDeltaTime() / 1000, 1 / 30);
    updatePlayer(dt);
    updateCamera();
    updateWebLine();
    updateHud();
  });

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  showToast("도시에 입장했다");
})();
