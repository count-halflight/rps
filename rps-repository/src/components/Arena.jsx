import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createMech } from "./proceduralFrame";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { cinematicFrame } from "../game/cinematics";
import { pulseRate } from "../game/calculus";

export default function Arena({
  weapon,
  animation,
  district,
  paused,
  enemyLevel,
  quality = "auto",
  reducedMotion = false,
  frameFinish,
  phase = "ready",
  onReady,
}) {
  const host = useRef(null),
    runtime = useRef({}),
    [failed, setFailed] = useState(false);
  runtime.current = {
    weapon,
    animation,
    district,
    paused,
    enemyLevel,
    quality,
    reducedMotion,
    frameFinish,
    phase,
  };
  useEffect(() => {
    const element = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      onReady?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    element.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 60);
    camera.position.set(0, 2.6, 9.6);
    camera.lookAt(0, 1.35, 0);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    const env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    scene.environmentIntensity = 0.65;
    room.dispose();
    scene.add(new THREE.HemisphereLight("#c6e8e4", "#13201c", 1.1));
    const key = new THREE.DirectionalLight("#eff8fc", 2.2);
    key.position.set(1, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    scene.add(key);
    const cyan = new THREE.PointLight("#39f4d2", 35, 8);
    cyan.position.set(-3, 2, 2);
    scene.add(cyan);
    const red = new THREE.PointLight("#ff5b4e", 30, 8);
    red.position.set(3, 2, 1);
    scene.add(red);
    const rim = new THREE.DirectionalLight("#9cadff", 1.8);
    rim.position.set(-1, 3, -4);
    scene.add(rim);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(5, 80),
      new THREE.ShadowMaterial({ opacity: 0.6 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.008;
    floor.receiveShadow = true;
    scene.add(floor);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(3.7, 3.85, 0.14, 80),
      new THREE.MeshBasicMaterial({
        color: "#0a1b1b",
        transparent: true,
        opacity: 0.65,
      }),
    );
    platform.position.y = -0.13;
    scene.add(platform);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(3.42 - i * 0.08, 0.009, 6, 100),
        new THREE.MeshBasicMaterial({
          color: i === 1 ? "#42746e" : "#273f3f",
          transparent: true,
          opacity: 0.75,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.044;
      scene.add(ring);
    }
    for (const s of [-1, 1]) {
      const sigil = new THREE.Mesh(
        new THREE.TorusGeometry(0.71, 0.012, 8, 50),
        new THREE.MeshBasicMaterial({
          color: s < 0 ? "#56dbc4" : "#ed7065",
          transparent: true,
          opacity: 0.55,
        }),
      );
      sigil.rotation.x = Math.PI / 2;
      sigil.position.set(s * 2.25, -0.024, 0);
      scene.add(sigil);
    }
    const player = createMech("#62e8ce");
    player.root.position.x = -2.3;
    player.root.scale.setScalar(1.28);
    player.root.rotation.y = 0.5;
    scene.add(player.root);
    const enemy = createMech("#ff7162", true);
    enemy.root.position.x = 2.3;
    enemy.root.scale.setScalar(1.28);
    enemy.root.rotation.y = -0.5;
    scene.add(enemy.root);
    enemy.setWeapon("scissors");
    let disposed = false;
    const frameMaterials = [],
      templates = new Map(),
      pendingFrames = new Set();
    let requestedFrame;
    const installFrame = (gltf, detail) => {
      if (disposed) return;
      element.dataset.frameAsset = "loaded";
      element.dataset.meshQuality = detail;
      frameMaterials.length = 0;
      lastFinish = null;
      needsRender = true;
      [player, enemy].forEach((mech, index) => {
        const model = gltf.scene.clone(true);
        const clones = new Map();
        model.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
          const convert = (original) => {
            if (clones.has(original)) return clones.get(original);
            const material = original.clone();
            material.normalMap = null;
            material.roughness = Math.max(0.38, material.roughness);
            if (index && material.name.startsWith("Emitter")) {
              material.color.set("#ff8c73");
              material.emissive.set("#ff654f");
              material.emissiveIntensity = 1.6;
            }
            if (index && material.name.startsWith("Veil")) {
              material.color.set("#ff866b");
              material.emissive.set("#9c3726");
            }
            if (index && material.name.startsWith("Shell"))
              material.color.set("#263037");
            if (!index) frameMaterials.push(material);
            clones.set(original, material);
            return material;
          };
          object.material = Array.isArray(object.material)
            ? object.material.map(convert)
            : convert(object.material);
        });
        for (const child of [...mech.root.children]) {
          child.traverse((object) => {
            object.geometry?.dispose();
            if (object.material)
              (Array.isArray(object.material)
                ? object.material
                : [object.material]
              ).forEach((material) => {
                material.map?.dispose();
                material.bumpMap?.dispose();
                material.dispose();
              });
          });
          mech.root.remove(child);
        }
        mech.root.add(model);
        mech.body = model.getObjectByName("body");
        mech.head = model.getObjectByName("head");
        mech.arms = [
          model.getObjectByName("arm_L"),
          model.getObjectByName("arm_R"),
        ];
        mech.legs = [
          model.getObjectByName("leg_L"),
          model.getObjectByName("leg_R"),
        ];
        mech.core = null;
        mech.weapons = ["L", "R"].map((side) => ({
          gauntlet: model.getObjectByName(`weapon_rock_${side}`),
          blades: model.getObjectByName(`weapon_scissors_${side}`),
          veil: model.getObjectByName(`weapon_paper_${side}`),
        }));
        mech.setWeapon = (id) =>
          mech.weapons.forEach((w) => {
            w.gauntlet.visible = id === "rock";
            w.blades.visible = id === "scissors";
            w.veil.visible = id === "paper";
          });
        mech.setWeapon(index ? "scissors" : runtime.current.weapon);
      });
    };
    const loadFrame = (light) => {
      const detail = light ? "low" : "full";
      requestedFrame = detail;
      if (element.dataset.meshQuality === detail) return;
      if (templates.has(detail)) {
        installFrame(templates.get(detail), detail);
        return;
      }
      if (pendingFrames.has(detail)) return;
      pendingFrames.add(detail);
      new GLTFLoader().load(
        light ? "/models/echo-frame-low.glb" : "/models/echo-frame.glb",
        (gltf) => {
          pendingFrames.delete(detail);
          templates.set(detail, gltf);
          if (!disposed && requestedFrame === detail)
            installFrame(gltf, detail);
        },
        undefined,
        () => {
          pendingFrames.delete(detail);
          if (!disposed && !element.dataset.meshQuality)
            element.dataset.frameAsset = "fallback";
        },
      );
    };
    loadFrame(runtime.current.quality === "low");

    const particlePositions = new Float32Array(120 * 3);
    for (let i = 0; i < 120; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 10;
      particlePositions[i * 3 + 1] = Math.random() * 6;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    const particlesGeo = new THREE.BufferGeometry();
    particlesGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3),
    );
    const particles = new THREE.Points(
      particlesGeo,
      new THREE.PointsMaterial({
        color: "#7fb8ae",
        size: 0.013,
        transparent: true,
        opacity: 0.6,
      }),
    );
    scene.add(particles);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.18, "rgba(200,255,240,.65)");
    gradient.addColorStop(1, "rgba(100,255,200,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const flareMap = new THREE.CanvasTexture(canvas);
    const coreHalos = [player, enemy].map((mech, index) => {
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flareMap,
          color: index ? "#ff6c52" : "#65ffd6",
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        }),
      );
      halo.position.set(index ? 2.3 : -2.3, 2.1, 0.4);
      halo.scale.set(0.5, 0.5, 0.5);
      scene.add(halo);
      return halo;
    });
    const shockwave = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 0.75, 72),
      new THREE.MeshBasicMaterial({
        color: "#65ffd6",
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    shockwave.rotation.x = -Math.PI / 2;
    shockwave.position.y = 0.03;
    scene.add(shockwave);
    const bladeArcs = [-1, 1].map((direction) => {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.018, 5, 40, Math.PI * 1.3),
        new THREE.MeshBasicMaterial({
          color: "#ffc580",
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      arc.position.set(direction * 0.5, 1.75, 0.5);
      arc.rotation.z = direction * 0.7;
      scene.add(arc);
      return arc;
    });
    const shieldPulse = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.9, 1),
      new THREE.MeshBasicMaterial({
        color: "#9cabff",
        transparent: true,
        opacity: 0,
        wireframe: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    shieldPulse.position.set(0, 1.65, 0.35);
    scene.add(shieldPulse);
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: flareMap,
        color: "#65ffd6",
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    flare.position.set(0, 2.2, 0.5);
    scene.add(flare);
    const sparks = [];
    for (let i = 0; i < 25; i++) {
      const spark = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: flareMap,
          color: i % 2 ? "#ff9970" : "#97ffe4",
          transparent: true,
          blending: THREE.AdditiveBlending,
          opacity: 0,
          depthWrite: false,
        }),
      );
      spark.scale.set(0.08, 0.08, 0.08);
      scene.add(spark);
      sparks.push({
        mesh: spark,
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 3,
        vz: (Math.random() - 0.5) * 2,
      });
    }
    const debris = Array.from({ length: 16 }, (_, index) => {
      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.06 + (index % 4) * 0.025, 0),
        new THREE.MeshStandardMaterial({
          color: index % 3 ? "#425559" : "#63e8cf",
          metalness: 0.75,
          roughness: 0.4,
          emissive: index % 3 ? "#000000" : "#244b43",
        }),
      );
      mesh.visible = false;
      scene.add(mesh);
      const angle = (index / 16) * Math.PI * 2;
      return {
        mesh,
        vx: Math.cos(angle) * (1.5 + (index % 3)),
        vz: Math.sin(angle) * 2,
        vy: 2.2 + (index % 4) * 0.6,
      };
    });
    const integralField = new THREE.Group();
    const integralSlices = Array.from({ length: 24 }, (_, i) => {
      const height = pulseRate(1, (i + 0.5) / 24) * 1.1;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.8 / 24 - 0.018, height, 0.045),
        new THREE.MeshBasicMaterial({
          color: "#a9b9ff",
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.position.set(-1.4 + ((i + 0.5) * 2.8) / 24, 0.35 + height / 2, 0.85);
      integralField.add(mesh);
      return mesh;
    });
    const curvePoints = Array.from(
      { length: 49 },
      (_, i) =>
        new THREE.Vector3(
          -1.4 + (i / 48) * 2.8,
          0.35 + pulseRate(1, i / 48) * 1.1,
          0.9,
        ),
    );
    integralField.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curvePoints),
        new THREE.LineBasicMaterial({
          color: "#ced6ff",
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
        }),
      ),
    );
    integralField.visible = false;
    scene.add(integralField);
    let frame,
      combatStart = -10000,
      lastAnimation,
      lastWeapon,
      lastEncounter,
      lastFinish,
      lastQuality,
      qualityReduced = false,
      qualityFrames = 0,
      qualityStarted = performance.now(),
      statsStarted = performance.now(),
      statsFrames = 0,
      lastRender = 0,
      needsRender = true,
      elapsed = 0,
      previous = performance.now();
    const cameraTarget = new THREE.Vector3();
    let homeDistance = 9.6;
    const resize = () => {
      const width = element.clientWidth,
        height = element.clientHeight;
      renderer.setSize(width, height);
      needsRender = true;
      camera.aspect = width / height;
      camera.fov = camera.aspect < 1.2 ? 43 : 36;
      camera.position.z = camera.aspect < 1.2 ? 11 : 9.6;
      homeDistance = camera.position.z;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    const contextLost = (e) => {
      e.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyQuality = (value) => {
      const light = value === "low" || (value === "auto" && qualityReduced);
      renderer.setPixelRatio(
        light
          ? 1
          : Math.min(window.devicePixelRatio, value === "high" ? 2 : 1.5),
      );
      renderer.shadowMap.enabled = !light;
      particles.visible = !light;
      cyan.visible = !light;
      red.visible = !light;
      loadFrame(light);
      element.dataset.renderQuality = light ? "light" : value;
      needsRender = true;
      resize();
    };
    const animate = (now) => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      const state = runtime.current;
      const reducedMotion = state.reducedMotion || motionQuery.matches;
      const still = state.paused || document.hidden || state.phase !== "ready";
      if (lastQuality !== state.quality) {
        lastQuality = state.quality;
        qualityReduced = false;
        qualityFrames = 0;
        qualityStarted = now;
        applyQuality(lastQuality);
      }
      if (state.frameFinish?.id !== lastFinish && frameMaterials.length) {
        lastFinish = state.frameFinish?.id;
        frameMaterials.forEach((material) => {
          if (
            material.name.startsWith("Shell") ||
            material.name.startsWith("Armor")
          )
            material.color.set(state.frameFinish?.shell || "#34474a");
          if (material.name.startsWith("Emitter")) {
            material.color.set(state.frameFinish?.color || "#6de7cb");
            material.emissive.set(state.frameFinish?.color || "#6de7cb");
          }
        });
        coreHalos[0].material.color.set(state.frameFinish?.color || "#6de7cb");
        needsRender = true;
      }
      const encounterKey = `${state.enemyLevel}/${state.district.background}`;
      if (lastWeapon !== state.weapon || lastEncounter !== encounterKey) {
        lastWeapon = state.weapon;
        lastEncounter = encounterKey;
        needsRender = true;
      }
      if (state.animation && lastAnimation !== state.animation.id) needsRender = true;
      const motionStill = reducedMotion && (!state.animation || (lastAnimation === state.animation.id && now - combatStart >= state.animation.duration));
      if ((still || motionStill) && !needsRender) return;
      if (!still) elapsed += dt;
      const t = elapsed;
      cyan.color.set(runtime.current.district.color);
      particles.material.color.set(runtime.current.district.color);
      enemy.root.scale.setScalar(
        runtime.current.enemyLevel % 5 === 0 ? 1.43 : 1.28,
      );
      if (
        runtime.current.animation &&
        lastAnimation !== runtime.current.animation.id
      ) {
        lastAnimation = runtime.current.animation.id;
        combatStart = now;
        if (!runtime.current.animation.finisher)
          enemy.setWeapon(runtime.current.animation.enemyWeapon);
      }
      const attack = (now - combatStart) / 1000;
      const cinematic = state.animation?.duration
        ? cinematicFrame(state.animation, attack)
        : null;
      const activeCinematic = cinematic && cinematic.progress < 1;
      const finishing = Boolean(cinematic && state.animation.finisher);
      element.dataset.cinematic = activeCinematic
        ? finishing
          ? "finisher"
          : "attack"
        : "idle";
      player.setWeapon(runtime.current.weapon);
      const lunge =
        !reducedMotion && cinematic
          ? cinematic.lunge
          : !reducedMotion && attack >= 0 && attack < 0.85
            ? Math.sin((attack / 0.85) * Math.PI)
            : 0;
      const revealed = !finishing || cinematic.progress >= 0.43;
      if (revealed && state.animation)
        enemy.setWeapon(state.animation.enemyWeapon);
      const success = !revealed || runtime.current.animation?.outcome === "win";
      const motionScale = (id) =>
        id === "paper" ? 0.4 : id === "scissors" ? 1.05 : 1;
      player.root.position.x =
        -2.3 + lunge * (success ? 1.95 : 1.3) * motionScale(state.weapon);
      enemy.root.position.x =
        2.3 -
        lunge *
          (success ? 1.3 : 1.95) *
          motionScale(state.animation?.enemyWeapon);
      const collapse =
        finishing && state.animation.finalHit && !reducedMotion
          ? cinematic.collapse
          : 0;
      const finishWeapon = state.animation?.playerWeapon;
      enemy.root.rotation.z =
        collapse *
        (finishWeapon === "rock"
          ? -0.82
          : finishWeapon === "paper"
            ? 0.2
            : 0.48);
      enemy.root.rotation.y =
        -0.5 +
        collapse *
          (finishWeapon === "paper"
            ? 3.1
            : finishWeapon === "scissors"
              ? -0.6
              : 0.1);
      enemy.root.position.y =
        collapse * (finishWeapon === "paper" ? 0.4 : -0.55);
      const enemyScale =
        (state.enemyLevel % 5 === 0 ? 1.43 : 1.28) *
        (1 - (finishWeapon === "paper" ? collapse * 0.8 : 0));
      enemy.root.scale.setScalar(enemyScale);
      [player, enemy].forEach((mech, index) => {
        const direction = index ? -1 : 1;
        const chosenWeapon = index
          ? runtime.current.animation?.enemyWeapon || "scissors"
          : state.weapon;
        mech.body.position.y = reducedMotion
          ? 0
          : Math.sin(t * 1.6 + index) * 0.018;
        mech.body.rotation.z = direction * lunge * -0.12;
        mech.head.rotation.y =
          (reducedMotion ? 0 : Math.sin(t * 0.35) * 0.07) + direction * 0.07;
        mech.arms[0].rotation.x =
          -0.18 +
          (reducedMotion ? 0 : Math.sin(t * 1.4) * 0.035) -
          lunge * 1.3 +
          (activeCinematic && !reducedMotion ? cinematic.windup * 0.65 : 0);
        mech.arms[1].rotation.x =
          -0.28 -
          (reducedMotion ? 0 : Math.sin(t * 1.4) * 0.035) -
          lunge * 0.65;
        mech.arms.forEach(
          (arm, i) => (arm.rotation.z = (i ? 1 : -1) * (0.16 + lunge * 0.07)),
        );
        if (chosenWeapon === "paper") {
          mech.body.rotation.y = 0;
          mech.arms[0].rotation.x -= lunge * 0.55;
          mech.arms[1].rotation.x -= lunge * 0.55;
          mech.arms.forEach(
            (arm, i) => (arm.rotation.z += (i ? -1 : 1) * lunge * 0.32),
          );
        } else if (chosenWeapon === "scissors") {
          mech.arms[0].rotation.z -= lunge * 0.7;
          mech.arms[1].rotation.z += lunge * 0.7;
          mech.body.rotation.y = direction * lunge * 0.28;
        } else {
          mech.arms[0].rotation.x -= lunge * 0.4;
          mech.body.rotation.y = -direction * lunge * 0.12;
        }
        mech.legs[0].rotation.x = lunge * -0.23;
        mech.legs[1].rotation.x = lunge * 0.2;
        if (mech.core) mech.core.scale.setScalar(1 + Math.sin(t * 2) * 0.1);
        mech.weapons.forEach((w) => {
          if (w.ring) w.ring.rotation.z = t * 0.5;
        });
      });
      const impact = cinematic
        ? activeCinematic
          ? cinematic.impact
          : 0
        : attack > 0.3 && attack < 0.65
          ? Math.sin(((attack - 0.3) / 0.35) * Math.PI)
          : 0;
      flare.material.opacity =
        impact * (reducedMotion ? 0.18 : finishing ? 1 : 0.8);
      flare.visible = impact > 0;
      flare.scale.setScalar(impact * (finishing ? 5.2 : 3.2));
      flare.material.color.set(
        success || finishing ? state.animation?.color || "#65ffd6" : "#ff6c52",
      );
      const effectWeapon =
        success || finishing ? state.weapon : state.animation?.enemyWeapon;
      const waveAge = cinematic
        ? (cinematic.progress - (state.animation.finisher ? 0.43 : 0.4)) *
          (state.animation.finisher ? 2 : 1.5)
        : attack - 0.34;
      shockwave.material.opacity =
        !reducedMotion &&
        effectWeapon === "rock" &&
        waveAge > 0 &&
        waveAge < 0.65
          ? (1 - waveAge / 0.65) * 0.7
          : 0;
      shockwave.scale.setScalar(1 + Math.max(0, waveAge) * (finishing ? 7 : 4));
      shockwave.material.color.copy(flare.material.color);
      shockwave.visible = shockwave.material.opacity > 0;
      bladeArcs.forEach((arc, index) => {
        arc.material.opacity =
          !reducedMotion && effectWeapon === "scissors" ? impact * 0.85 : 0;
        arc.rotation.y = (index ? -1 : 1) * lunge * 1.7;
        arc.scale.setScalar(finishing ? 1.8 : 1);
        arc.visible = arc.material.opacity > 0;
      });
      shieldPulse.material.opacity =
        !reducedMotion && effectWeapon === "paper" ? impact * 0.5 : 0;
      shieldPulse.position.x = finishing ? enemy.root.position.x : 0;
      shieldPulse.scale.setScalar(
        finishing ? 2.4 * (1 - collapse * 0.75) : 0.7 + impact * 0.9,
      );
      shieldPulse.visible = shieldPulse.material.opacity > 0;
      integralField.visible = Boolean(
        activeCinematic &&
        state.animation.playerWeapon === "paper" &&
        !reducedMotion &&
        cinematic.progress > 0.12 &&
        cinematic.progress < 0.88,
      );
      if (integralField.visible) {
        integralField.position.x = finishing ? enemy.root.position.x : 0;
        integralField.scale.setScalar(finishing ? 1.2 - collapse * 0.75 : 0.95);
        integralSlices.forEach((slice, i) => {
          slice.material.opacity =
            i / 24 < (cinematic.progress - 0.12) / 0.32
              ? 0.32 * (1 - collapse * 0.7)
              : 0.025;
        });
      }
      shieldPulse.rotation.y = t * 0.5;
      coreHalos.forEach((halo, index) => {
        halo.position.x = (index ? enemy : player).root.position.x;
        halo.material.opacity = reducedMotion
          ? 0.25
          : 0.3 + Math.sin(t * 2) * 0.06 + impact * 0.12;
      });
      sparks.forEach((s) => {
        const age = waveAge;
        s.mesh.material.opacity =
          !reducedMotion && age > 0 && age < 0.7 ? 1 - age / 0.7 : 0;
        s.mesh.visible = s.mesh.material.opacity > 0;
        s.mesh.position.set(
          s.vx * age,
          1.6 + s.vy * age - 3 * age * age,
          s.vz * age + 0.5,
        );
      });
      debris.forEach((piece, i) => {
        const age = waveAge;
        piece.mesh.visible = Boolean(
          finishing &&
          !reducedMotion &&
          finishWeapon === "rock" &&
          age > 0 &&
          age < 1.2,
        );
        if (!piece.mesh.visible) return;
        piece.mesh.position.set(
          0.4 + piece.vx * age,
          Math.max(0.05, 1.6 + piece.vy * age - 4 * age * age),
          piece.vz * age,
        );
        piece.mesh.rotation.set(age * (i + 1), age * 3, age * 2);
      });
      const cameraPose =
        activeCinematic && !reducedMotion ? cinematic.camera : [0, 2.6, 9.6];
      const lookPose =
        activeCinematic && !reducedMotion ? cinematic.target : [0, 1.35, 0];
      camera.position.set(
        cameraPose[0] +
          (reducedMotion ? 0 : impact) *
            Math.sin(t * 70) *
            (finishing ? 0.075 : 0.035),
        cameraPose[1],
        cameraPose[2] * (homeDistance / 9.6),
      );
      camera.lookAt(cameraTarget.set(...lookPose));
      particles.rotation.y = reducedMotion ? 0 : t * 0.02;
      if (
        !needsRender &&
        now - lastRender <
          (state.quality === "high"
            ? 15
            : state.quality === "low" || qualityReduced
              ? 60
              : 30)
      )
        return;
      renderer.render(scene, camera);
      needsRender = false;
      lastRender = now;
      qualityFrames++;
      statsFrames++;
      if (now - statsStarted > 2000) {
        element.dataset.fps = String(
          Math.round((statsFrames * 1000) / (now - statsStarted)),
        );
        element.dataset.drawCalls = String(renderer.info.render.calls);
        element.dataset.triangles = String(renderer.info.render.triangles);
        statsFrames = 0;
        statsStarted = now;
      }
      if (
        !still &&
        !reducedMotion &&
        state.quality === "auto" &&
        !qualityReduced &&
        now - qualityStarted > 6500 &&
        qualityFrames / ((now - qualityStarted) / 1000) < 24
      ) {
        qualityReduced = true;
        applyQuality("auto");
      }
    };
    frame = requestAnimationFrame(animate);
    onReady?.();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      scene.traverse((o) => {
        o.geometry?.dispose();
        o.material?.map?.dispose();
        o.material?.bumpMap?.dispose();
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
      });
      templates.forEach((gltf) =>
        gltf.scene.traverse((object) => {
          object.geometry?.dispose();
          if (object.material)
            (Array.isArray(object.material)
              ? object.material
              : [object.material]
            ).forEach((material) => material.dispose());
        }),
      );
      flareMap.dispose();
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      className="arena-render"
      ref={host}
      aria-label="Live 3D arena with two articulated cybernetic fighters"
    >
      {failed && (
        <div className="render-fallback">
          3D rendering is unavailable on this device. The circuit is still
          playable.
        </div>
      )}
    </div>
  );
}
