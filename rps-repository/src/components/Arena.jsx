import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createFighter } from "./fighters";
import { createRiggedFighter } from "./riggedFighter";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { assetUrl } from "../game/assets";
import { createEnvironment } from "./environments";
import { cinematicFrame } from "../game/cinematics";
import { FIGHTERS, fighterFor, rivalFighter } from "../game/fighters";
const smoothArrow = (progress, hit, i, count) =>
  Math.max(
    0,
    Math.min(1, (progress - (hit - 0.25 + (i / count) * 0.12)) / 0.25),
  );
export default function Arena(props) {
  const host = useRef(null),
    runtime = useRef(props),
    [failed, setFailed] = useState(false);
  runtime.current = props;
  useEffect(() => {
    const el = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      props.onReady?.();
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#11171b");
    scene.fog = new THREE.FogExp2("#152024", 0.045);
    scene.add(new THREE.HemisphereLight("#c7dedb", "#3c252c", 2.4));
    const key = new THREE.DirectionalLight("#ffe3cb", 3.3);
    key.position.set(-2, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.normalBias = 0.035;
    key.shadow.bias = -0.0003;
    scene.add(key);
    const rim = new THREE.DirectionalLight("#80cdd6", 2);
    rim.position.set(2, 4, -4);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 90),
      environment = createEnvironment(scene);
    const players = FIGHTERS.map((f, i) => createFighter(i % 3, f.color)),
      enemies = FIGHTERS.map((f, i) => createFighter(i % 3, f.color));
    let player = players[0],
      enemy = enemies[4];
    scene.add(...players.map((p) => p.root), ...enemies.map((e) => e.root));
    players.forEach((p, i) => (p.root.visible = i === 0));
    enemies.forEach((e, i) => (e.root.visible = i === 4));
    let loaded = 0;
    const loader = new GLTFLoader();
    FIGHTERS.forEach((f, i) =>
      loader.load(
        assetUrl(`models/${f.model}-human.glb`),
        (gltf) => {
          if (disposed) return;
          scene.remove(players[i].root, enemies[i].root);
          players[i] = createRiggedFighter(gltf, f.color, f.style);
          enemies[i] = createRiggedFighter(gltf, f.color, f.style);
          players[i].root.visible = false;
          enemies[i].root.visible = false;
          scene.add(players[i].root, enemies[i].root);
          lastLevel = null;
          lastCharacter = null;
          lastFinish = null;
          loaded++;
          if (loaded === 5) {
            el.dataset.frameAsset = "loaded";
            props.onReady?.();
          }
        },
        undefined,
        () => {
          el.dataset.frameAsset = "fallback";
          props.onReady?.();
        },
      ),
    );
    const effects = new THREE.Group();
    scene.add(effects);
    const bright = new THREE.MeshBasicMaterial({
      color: "#83ffd6",
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    const burst = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uStrength: { value: 0 },
          uColor: { value: new THREE.Color("#83ffd6") },
        },
        vertexShader:
          "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
        fragmentShader:
          "varying vec2 vUv;uniform float uTime;uniform float uStrength;uniform vec3 uColor;void main(){vec2 p=(vUv-.5)*vec2(1.8,1.);float r=length(p);float a=atan(p.y,p.x);float rays=pow(abs(sin(a*19.+uTime*1.8+r*9.)),14.);float ring=pow(abs(sin(r*28.-uTime*13.)),24.);float core=exp(-r*8.);float alpha=uStrength*(core*.9+rays*.32+ring*.22)*(1.-smoothstep(.3,.9,r));gl_FragColor=vec4(mix(uColor,vec3(1.),core),alpha);}",
      }),
    );
    burst.position.set(0, 1.7, -2.3);
    scene.add(burst);
    const wave = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.03, 6, 80),
      bright,
    );
    wave.rotation.x = Math.PI / 2;
    effects.add(wave);
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: "#d0bcff",
        wireframe: true,
        transparent: true,
        opacity: 0.6,
      }),
    );
    effects.add(orb);
    const ribbons = [];
    for (let i = 0; i < 6; i++) {
      const arc = new THREE.Mesh(
        new THREE.TorusGeometry(1.1, 0.035, 5, 48, Math.PI * 1.35),
        new THREE.MeshBasicMaterial({
          color: "#ffb35e",
          transparent: true,
          opacity: 0.9,
        }),
      );
      effects.add(arc);
      ribbons.push(arc);
    }
    const slices = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1, 0.12),
        new THREE.MeshBasicMaterial({
          color: i % 2 ? "#d0bcff" : "#8df3d1",
          transparent: true,
          opacity: 0.5,
        }),
      );
      effects.add(m);
      slices.push(m);
    }
    const arrows = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.035, 0.65, 4),
      new THREE.MeshBasicMaterial({ color: "#ffe1a3" }),
      24,
    );
    effects.add(arrows);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 4, 8),
      new THREE.MeshBasicMaterial({
        color: "#ccb2ff",
        transparent: true,
        opacity: 0.7,
      }),
    );
    beam.rotation.z = Math.PI / 2;
    effects.add(beam);
    const debris = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.12, 0.12, 0.12),
      new THREE.MeshStandardMaterial({ color: "#6c706d", roughness: 0.8 }),
      45,
    );
    effects.add(debris);
    const dummy = new THREE.Object3D();
    let adaptiveLow = false;
    let id,
      lastFinish,
      lastLevel,
      lastCharacter,
      started = 0,
      raf,
      lastTime = performance.now(),
      time = 0,
      visible = true,
      frames = 0,
      frameStart = performance.now(),
      disposed = false;
    const resize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight);
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const visibility = () => {
      visible = !document.hidden;
      lastTime = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    const render = (now) => {
      raf = requestAnimationFrame(render);
      const state = runtime.current;
      if (!visible || state.paused) {
        lastTime = now;
        return;
      }
      const reduced =
        state.reducedMotion ||
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      time += Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const low =
        state.quality === "low" || (state.quality === "auto" && adaptiveLow);
      renderer.shadowMap.enabled = !low;
      const ratio = low ? 1 : Math.min(devicePixelRatio, 1.5);
      if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
      if (lastCharacter !== state.character) {
        lastCharacter = state.character;
        player = players[FIGHTERS.indexOf(fighterFor(state.character))];
        players.forEach((p) => (p.root.visible = p === player));
        lastFinish = null;
      }
      const enemyId = state.enemyCharacter || rivalFighter(state.enemyLevel).id;
      if (
        lastLevel !== `${state.enemyLevel}-${enemyId}-${state.previewSingle}`
      ) {
        lastLevel = `${state.enemyLevel}-${enemyId}-${state.previewSingle}`;
        enemy = enemies[FIGHTERS.indexOf(fighterFor(enemyId))];
        enemies.forEach(
          (e) => (e.root.visible = e === enemy && !state.previewSingle),
        );
      }
      if (lastFinish !== `${state.frameFinish?.id}-${state.character}`) {
        lastFinish = `${state.frameFinish?.id}-${state.character}`;
        player.glow.color.set(
          state.frameFinish?.id && state.frameFinish.id !== "echo"
            ? state.frameFinish.color
            : fighterFor(state.character).color,
        );
        player.glow.emissive.set(
          state.frameFinish?.id && state.frameFinish.id !== "echo"
            ? state.frameFinish.color
            : fighterFor(state.character).color,
        );
      }
      if (state.animation?.id !== id) {
        id = state.animation?.id;
        started = now;
      }
      const a = state.animation,
        elapsed = (now - started) / 1000;
      const frame = a ? cinematicFrame(a, elapsed) : null,
        active = frame && frame.progress < 1;
      el.dataset.cinematic = active
        ? `${frame.weapon}-${a.finisher ? "final" : a.variant}`
        : "idle";
      player.root.position.set(
        -2.1,
        reduced ? 0 : Math.sin(time * 2) * 0.015,
        0,
      );
      enemy.root.position.set(
        2.1,
        reduced ? 0 : Math.sin(time * 1.8) * 0.015,
        0,
      );
      player.root.rotation.set(0, 0.95, 0);
      enemy.root.rotation.set(0, -0.95, 0);
      player.root.scale.setScalar(1.35);
      enemy.root.scale.setScalar(1.42);
      player.pose({}, time);
      enemy.pose({}, time);
      player.setWeapon(state.weapon);
      enemy.setWeapon(a && active ? a.enemyWeapon : null);
      if (state.previewSingle) {
        player.root.position.set(0, 0, 0);
        player.root.rotation.y = 0.35 + Math.sin(time * 0.25) * 0.12;
      }
      if (!active && state.phase === "upgrade") {
        enemy.root.rotation.z = -1.4;
        enemy.root.position.y = -0.1;
      }
      if (!active && state.phase === "defeat") {
        player.root.rotation.z = 1.4;
        player.root.position.y = -0.1;
      }
      effects.visible = Boolean(
        active && frame.revealed && a.outcome !== "draw",
      );
      wave.visible = false;
      orb.visible = false;
      ribbons.forEach((r) => (r.visible = false));
      slices.forEach((r) => (r.visible = false));
      debris.visible = false;
      arrows.visible = false;
      beam.visible = false;
      if (active && frame.revealed && a.outcome !== "draw") {
        const loss = a.outcome === "loss",
          attacker = loss ? enemy : player,
          defender = loss ? player : enemy,
          sign = loss ? -1 : 1,
          pose = frame.attacker;
        attacker.setWeapon(frame.weapon);
        attacker.pose(pose, time);
        attacker.root.position.set(sign * (-2.1 + pose.x), pose.y, pose.z);
        attacker.root.rotation.y = sign * 0.95 + pose.yaw * sign;
        const knock =
          frame.impact * 0.25 + frame.release * 0.35 * (1 - frame.returnHome);
        defender.root.position.x = sign * (2.1 + knock);
        defender.pose(
          {
            body: -0.35 * frame.impact,
            armL: -0.55 - 1.2 * frame.impact,
            armR: -0.55 - 1.2 * frame.impact,
          },
          time,
        );
        if (a.finisher && a.finalHit) {
          if (frame.weapon === "paper") {
            defender.root.position.y = frame.release * 2;
            defender.root.rotation.y += frame.release * 3;
            defender.root.scale.setScalar(1.42 * (1 - frame.collapse * 0.92));
          } else if (frame.weapon === "scissors") {
            defender.root.rotation.z = -sign * frame.collapse * 1.35;
            defender.root.position.y = -frame.collapse * 0.3;
          } else {
            defender.root.position.x = sign * (2.1 + frame.collapse);
            defender.root.rotation.z = -sign * frame.collapse * 1.4;
          }
        }
        const color = a.color;
        bright.color.set(color);
        effects.position.x = sign * 1.5;
        if (frame.weapon === "rock" && a.style !== "archer") {
          wave.visible = true;
          wave.position.y = 0.05;
          wave.scale.setScalar(0.3 + frame.shock * 5);
          bright.opacity = (1 - frame.release) * 0.9;
          debris.visible = frame.progress >= a.impactAt;
          for (let i = 0; i < 45; i++) {
            const age = frame.release,
              angle = i * 2.4;
            dummy.position.set(
              Math.cos(angle) * age * 3,
              Math.max(0, Math.sin(age * Math.PI) * (1 + (i % 4) * 0.3)),
              Math.sin(angle) * age * 3,
            );
            dummy.rotation.set(age * i, age * i, 0);
            dummy.scale.setScalar(1 - age * 0.8);
            dummy.updateMatrix();
            debris.setMatrixAt(i, dummy.matrix);
          }
          debris.instanceMatrix.needsUpdate = true;
        }
        if (
          (frame.weapon === "paper" || a.style === "mage") &&
          a.style !== "archer"
        ) {
          orb.visible = true;
          orb.position.y = 1.5 + frame.release * 0.7;
          orb.scale.setScalar(0.2 + frame.contact * 1.3);
          orb.rotation.set(time * 0.7, time * 0.4, 0);
          orb.material.opacity = 0.8 * (1 - frame.returnHome);
          for (let i = 0; i < 24; i++) {
            const s = slices[i];
            s.visible = true;
            const u = (i + 0.5) / 24,
              height = (0.25 + Math.sin(u * Math.PI) * 1.6) * frame.contact;
            s.scale.set(1, height, 1);
            s.position.set(
              (u - 0.5) * 3,
              height / 2 + 0.1,
              Math.sin(time + u * 8) * 0.15,
            );
            s.rotation.z = frame.release * (i - 12) * 0.12;
          }
        }
        if (a.style === "archer") {
          arrows.visible = frame.contact > 0.1;
          const count = a.finisher ? 24 : 3 + 3 * a.variant;
          arrows.count = count;
          for (let i = 0; i < count; i++) {
            const flight = smoothArrow(frame.progress, a.impactAt, i, count);
            dummy.position.set(
              sign * (-3.6 + flight * 4),
              (a.finisher ? 1.4 + 3.5 * (1 - flight) : 1.5) +
                Math.sin(i * 3) * 0.2,
              (i - count / 2) * 0.08,
            );
            dummy.rotation.set(
              0,
              0,
              (-sign * Math.PI) / 2 - (a.finisher ? sign * 0.6 : 0),
            );
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            arrows.setMatrixAt(i, dummy.matrix);
          }
          arrows.instanceMatrix.needsUpdate = true;
        }
        if (a.style === "mage" && frame.weapon !== "paper") {
          beam.visible = frame.contact > 0.4 && frame.release < 0.8;
          beam.position.set(-sign * 1.5, 1.7, 0);
          beam.scale.x = 1 + frame.impact * 3;
          beam.material.color.set(a.color);
        }
        if (
          frame.weapon === "scissors" ||
          a.style === "blades" ||
          a.style === "glaive"
        ) {
          ribbons.forEach((r, i) => {
            r.visible = i < (a.finisher ? 6 : 2);
            r.position.set(Math.sin(i * 2) * 0.4, 1.5, 0);
            r.rotation.set(
              0.4 + i * 0.5,
              0.2 + i * 0.3,
              (i % 2 ? -1 : 1) * time * 4,
            );
            r.scale.setScalar(0.45 + frame.contact * 0.9);
            r.material.color.set(a.color);
            r.material.opacity = (1 - frame.returnHome) * 0.75;
          });
        }
      }
      let pos = state.previewSingle
          ? [0, 2.7, 7]
          : active
            ? frame.camera
            : [0, 3.1, 10.4],
        target = state.previewSingle
          ? [0, 1.65, 0]
          : active
            ? frame.target
            : [0, 1.7, 0];
      const widthFactor = Math.max(1, 0.98 / camera.aspect);
      camera.position.set(pos[0], pos[1], pos[2] * widthFactor);
      camera.lookAt(...target);
      if (active && !reduced) {
        camera.position.x += Math.sin(now * 0.09) * frame.impact * 0.1;
        camera.position.y += Math.cos(now * 0.11) * frame.impact * 0.065;
      }
      burst.material.uniforms.uTime.value = time;
      burst.material.uniforms.uStrength.value =
        active && frame.revealed
          ? (a.finisher
              ? frame.contact * 0.65 + frame.impact
              : frame.impact * 0.7) *
            (1 - frame.returnHome)
          : 0;
      burst.material.uniforms.uColor.value.set(a?.color || "#83ffd6");
      scene.background.set("#11171b");
      scene.fog.color.set("#152024");
      if (active && a.finisher && frame.revealed) {
        const tint = new THREE.Color(a.color);
        scene.background.lerp(tint, frame.impact * 0.6);
        scene.fog.color.lerp(tint, frame.impact * 0.45);
        key.intensity = 3.3 + frame.impact * 4;
      } else key.intensity = 3.3;
      environment.update(
        time,
        state.enemyLevel,
        state.district,
        active ? frame : null,
        reduced,
      );
      renderer.render(scene, camera);
      frames++;
      if (now - frameStart > 1500) {
        const fps = (frames * 1000) / (now - frameStart);
        el.dataset.fps = fps.toFixed(1);
        if (time > 6 && fps < 25) adaptiveLow = true;
        frames = 0;
        frameStart = now;
      }
      el.dataset.drawCalls = renderer.info.render.calls;
      el.dataset.triangles = renderer.info.render.triangles;
      el.dataset.renderQuality = low ? "light" : "full";
    };
    el.dataset.frameAsset = "loading";
    el.dataset.meshQuality = "anatomical-human";
    raf = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
      scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach(
            (m) => {
              materials.add(m);
              if (m.map) textures.add(m.map);
            },
          );
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="three-arena" ref={host} aria-hidden="true">
      {failed && (
        <div className="fallback-arena">
          3D rendering is unavailable on this device. Combat controls remain
          playable.
        </div>
      )}
    </div>
  );
}
