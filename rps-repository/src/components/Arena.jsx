import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createRiggedFighter } from "./riggedFighter";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { assetUrl } from "../game/assets";
import { createEnvironment } from "./environments";
import { cinematicFrame } from "../game/cinematics";
import { FIGHTERS, fighterFor, rivalFighter } from "../game/fighters";
import { createFilmRenderer, createClothMaps } from "./filmRenderer";
import { createCombatEffects } from "./combatEffects";
import { createCinematicWorld } from './cinematicWorld.js';
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
        preserveDrawingBuffer:import.meta.env.DEV&&new URLSearchParams(location.search).has('proof'),
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
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#11171b");
    scene.fog = new THREE.FogExp2("#152024", 0.045);
    const arenaFog = scene.fog;
    const arenaBackground = scene.background;
    scene.add(new THREE.HemisphereLight("#a9cddd", "#312331", 1.25));
    const key = new THREE.DirectionalLight("#ffe3cb", 2.4);
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
    const rim = new THREE.DirectionalLight("#a2bfff", 1.9);
    rim.position.set(2, 4, -4);
    scene.add(rim);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 90),
      environment = createEnvironment(scene),
      film = createFilmRenderer(renderer, scene, camera),
      clothMaps = createClothMaps();
    const combatEffects = createCombatEffects(scene);
    const cinematicWorld = createCinematicWorld(scene);
    const pendingFighter=f=>({root:new THREE.Group(),pose(){},setWeapon(){},glow:new THREE.MeshStandardMaterial({color:f.color,emissive:f.color})});
    const players = FIGHTERS.map(pendingFighter),
      enemies = FIGHTERS.map(pendingFighter);
    let player = players[0],
      enemy = enemies[4];
    scene.add(...players.map((p) => p.root), ...enemies.map((e) => e.root));
    players.forEach((p) => (p.root.visible = false));
    enemies.forEach((e) => (e.root.visible = false));
    let loaded = 0;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    FIGHTERS.forEach((f, i) =>
      loader.load(
        assetUrl(`models/${f.model}-human.glb`),
        (gltf) => {
          if (disposed) return;
          scene.remove(players[i].root, enemies[i].root);
          players[i].glow.dispose();enemies[i].glow.dispose();
          players[i] = createRiggedFighter(gltf, f.color, f.style);
          enemies[i] = createRiggedFighter(gltf, f.color, f.style);
          for(const fighter of [players[i],enemies[i]]) fighter.model.traverse(o=>{
            if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
              m.envMapIntensity=.75;
              if(/jacket|trousers|Shirt/.test(m.name)){
                m.roughnessMap=clothMaps.roughness;m.normalMap=clothMaps.normal;
                m.normalScale=new THREE.Vector2(.26,.26);
              }
            }
          });
          players[i].equipAppearance({color:f.color,kit:{layer:{echo:'vest',cinder:'vest',nyx:'cape',vex:'vest',kuro:'coat'}[f.id],detail:{echo:'scarf',cinder:'plates',nyx:'collar',vex:'scarf',kuro:'plates'}[f.id]}});
          players[i].root.visible = false;
          enemies[i].root.visible = false;
          scene.add(players[i].root, enemies[i].root);
          lastLevel = null;
          lastCharacter = null;
          lastFinish = null;
          loaded++;
        },
        undefined,
        () => {
          el.dataset.frameAsset = "fallback";
          setFailed(true);
          props.onReady?.();
        },
      ),
    );
    const shadowData=new Uint8Array(64*64*4);
    for(let y=0;y<64;y++)for(let x=0;x<64;x++){const d=Math.hypot((x-31.5)/32,(y-31.5)/32);shadowData.set([6,19,27,Math.round(Math.max(0,1-d)**2*155)],(y*64+x)*4);}
    const shadowMap=new THREE.DataTexture(shadowData,64,64);shadowMap.needsUpdate=true;
    const shadowMat=new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false});
    const footShadows=[0,1].map(()=>{const s=new THREE.Mesh(new THREE.CircleGeometry(.48,24),shadowMat);s.rotation.x=-Math.PI/2;s.position.y=.004;scene.add(s);return s;});
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
      new THREE.SphereGeometry(1, 40, 24),
      new THREE.MeshPhysicalMaterial({
        color: "#d0bcff",
        emissive: "#7764cd",emissiveIntensity:1.1,roughness:.15,metalness:.3,
        transparent: true,
        opacity: 0.35,
      }),
    );
    effects.add(orb);
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
      renderWidth = 0,
      renderHeight = 0,
      needsRedraw = true,
      lastQualityLow = false,
      disposed = false;
    const resize = () => {
      const width=Math.max(1,el.clientWidth),height=Math.max(1,el.clientHeight);
      if(width===renderWidth&&height===renderHeight)return;
      renderWidth=width;renderHeight=height;needsRedraw=true;
      renderer.setSize(width,height);
      film.resize(width,height);
      camera.aspect = width / height;
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
      if(disposed)return;
      raf = requestAnimationFrame(render);
      const state = runtime.current;
      el.dataset.paused=String(Boolean(state.paused));
      el.dataset.visible=String(visible);
      if (!visible || state.paused) {
        lastTime = now;
        // A fullscreen or layout resize clears the drawing buffer. Restore
        // the frozen scene once, keeping the paused actors and clock still.
        if(visible&&needsRedraw){film.render(lastQualityLow,time,0,false);needsRedraw=false;}
        return;
      }
      scene.fog=arenaFog;
      scene.background=arenaBackground;
      const reduced =
        state.reducedMotion ||
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      time += Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      const low =
        state.quality === "low" || (state.quality === "auto" && adaptiveLow);
      renderer.shadowMap.enabled = !low;
      const ratio = import.meta.env.DEV&&new URLSearchParams(location.search).has('proof')?.65:low ? 1 : Math.min(devicePixelRatio, 1.5);
      if (renderer.getPixelRatio() !== ratio) {
        renderer.setPixelRatio(ratio);
        film.resize(el.clientWidth,el.clientHeight);
      }
      if (lastCharacter !== state.character) {
        lastCharacter = state.character;
        player = players[FIGHTERS.indexOf(fighterFor(state.character))];
        players.forEach((p) => (p.root.visible = p === player));
        lastFinish = null;
      }
      const enemyId = state.enemyCharacter || rivalFighter(state.enemyLevel).id;
      if (
        lastLevel !== `${state.enemyLevel}-${enemyId}-${state.enemyAppearance?.id}-${state.previewSingle}`
      ) {
        lastLevel = `${state.enemyLevel}-${enemyId}-${state.enemyAppearance?.id}-${state.previewSingle}`;
        enemy = enemies[FIGHTERS.indexOf(fighterFor(enemyId))];
        enemy.equipAppearance?.(state.enemyAppearance||{});
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
        started = state.animation?.startedAt??now;
      }
      const a = state.animation,
        elapsed = (now - started) / 1000;
      const enemyScale=1.42*(state.enemyAppearance?.scale || 1);
      const frame = a ? cinematicFrame({...a,actorScale:a.outcome==='loss'?enemyScale:1.35,targetScale:a.outcome==='loss'?1.35:enemyScale}, elapsed) : null,
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
      enemy.root.scale.setScalar(enemyScale);
      player.pose({}, time);
      const personality=state.enemyAppearance?.personality;
      const idle=personality==='aggressor'?{torsoPitch:.16,handL:[.24,1.6,.36],handR:[-.24,1.58,.35]}:
        personality==='patient'?{handL:[.20,1.68,.36],handR:[-.20,1.64,.34],headPitch:-.04}:
        personality==='bluffer'?{headYaw:Math.sin(time*.65)*.12,handR:[-.32,1.38+Math.sin(time*.6)*.10,.22]}:
        personality==='gambler'?{torsoYaw:Math.sin(time*.8)*.12,headPitch:Math.sin(time*.7)*.04}:
        personality==='mimic'?{headYaw:Math.sin(time*.32)*.09}:{};
      enemy.pose(reduced?{}:idle, time);
      player.setWeapon(state.weapon);
      enemy.setWeapon(a && active ? a.enemyWeapon : null);
      if(state.reveal?.revealed){
        const clash=state.reveal.outcome==='draw';
        player.root.rotation.y=Math.PI/2;enemy.root.rotation.y=-Math.PI/2;
        player.pose({handL:[.24,1.61,.50],handR:[-.22,1.56,.45],torsoYaw:clash?.15:-.15},time);
        enemy.pose({handL:[.24,1.61,.50],handR:[-.22,1.56,.45],torsoYaw:clash?-.15:.15},time);
      }
      if (state.previewSingle) {
        player.root.position.set(0, 0, 0);
        player.root.rotation.y = reduced ? -.25 : state.titleHero ? -.25+Math.sin(time*.18)*.3 : time*.13;
        // Portraits show the face and garment silhouette, with the weapon held
        // off the centreline instead of directly in front of the eyes.
        const style=fighterFor(state.character).style;
        const portrait={
          blades:{handL:[.40,1.08,.20],handR:[-.36,1.10,.22],weaponPitch:-.18},
          brawler:{handL:[.30,1.35,.25],handR:[-.30,1.34,.25]},
          mage:{handL:[.47,1.04,.18],handR:[-.24,1.20,.18],weaponPitch:.03},
          archer:{handL:[.46,1.20,.17],handR:[-.25,1.22,.14],weaponPitch:-.10,draw:.1},
          glaive:{handL:[.44,1.12,.18],handR:[-.30,1.26,.16],weaponPitch:-.06},
        }[style];
        player.pose({...portrait,headPitch:-.01,headYaw:.03},time);
      }
      if (!active && state.phase === "upgrade") {
        enemy.pose({roll:-1.35},time);
        enemy.root.position.y = -.92;
      }
      if (!active && state.phase === "defeat") {
        player.pose({roll:1.35},time);
        player.root.position.y = -.92;
      }
      effects.visible = Boolean(
        active && frame.revealed && a.outcome !== "draw" && !frame.spectacle,
      );
      wave.visible = false;
      orb.visible = false;
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
        attacker.root.rotation.y = sign * Math.PI/2 + pose.yaw * sign;
        defender.root.position.set(sign * (2.1 + frame.defender.x),frame.defender.y,frame.defender.z||0);
        defender.root.rotation.y = -sign * Math.PI/2 + (frame.defender.yaw||0)*sign;
        if (frame.defender.stretch) defender.root.scale.multiply(new THREE.Vector3(...frame.defender.stretch));
        defender.pose({...frame.defender,roll:frame.defender.roll*sign},time);
        frame.contactPosition = defender.root.position.toArray();
        frame.contactPosition[1] += 1.48 * (loss ? 1.35 : enemyScale);
        const color = a.color;
        bright.color.set(color);
        effects.position.x = sign * 2.1;
        combatEffects.update(attacker,frame,a,sign,time,low);
        if ((a.style === "brawler" || (a.style === "glaive" && a.finisher)) && frame.progress>=a.impactAt) {
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
          frame.weapon === "paper" && a.style === "mage"
        ) {
          orb.visible = true;
          orb.position.y = 1.5 + frame.release * 0.7;
          orb.scale.setScalar(.2 + frame.contact * (/gravity|singularity/.test(frame.vfx)?1.6:/wave/.test(frame.vfx)?.7:1.2));
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
            if(/gravity/.test(frame.vfx)){s.position.y=1.6+Math.cos(u*Math.PI*2+time)*.6;s.position.z=Math.sin(u*Math.PI*2+time)*.8;}
            if(/wave/.test(frame.vfx)){s.position.x-=sign*(1-frame.contact)*3;s.scale.z=.3;}
          }
        }
        if (a.style === "archer") {
          arrows.visible = frame.contact > 0.1;
          const rain=/meteor|starfall/.test(frame.vfx),fan=/volley|scatter/.test(frame.vfx),bank=/ricochet/.test(frame.vfx),pin=/pin/.test(frame.vfx);
          const count = rain ? a.finisher?24:12 : fan?7+a.variant*3:pin?5:1;
          arrows.count = count;
          for (let i = 0; i < count; i++) {
            const flight = smoothArrow(frame.progress, a.impactAt, i, count);
            dummy.position.set(
              sign * (-4.4 + flight * 4.4),
              (rain ? 2.0 + 4.5 * (1 - flight) : 2.0) +
                Math.sin(i * 3) * 0.2,
              (i-(count-1)/2)*(fan?.25:rain?.12:.035)*(1-flight*.6)+(bank?Math.sin(flight*Math.PI)*1.7:0),
            );
            dummy.rotation.set(
              0,
              0,
              (-sign * Math.PI) / 2 - (rain ? sign * 0.6 : 0),
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
      } else combatEffects.reset();
      footShadows.forEach((s,i)=>{const f=i?enemy:player;s.visible=f.root.visible && f.root.position.y < .65 && frame?.spectacle?.world!=='space' && frame?.spectacle?.world!=='void';s.position.x=f.root.position.x;s.position.z=f.root.position.z;s.scale.set(1.1,1,.55);});
      const idleHeight=Math.max(1.7,enemy.root.scale.y*1.05),idleDepth=Math.max(10.4,enemy.root.scale.y*5.1);
      let pos = state.previewSingle
          ? state.titleHero?[1.8,2.65,6.3]:[0, 2.7, 7]
          : active
            ? frame.camera
            : [0, idleHeight+1.4, idleDepth],
        target = state.previewSingle
          ? [0, 1.65, 0]
          : active
            ? frame.target
            : [0, idleHeight, 0];
      if(state.entrance&&!active&&!reduced){
        const phase=state.entrance.kind==='phase';
        const drift=Math.sin(time*.55)*.45;
        const scale=enemy.root.scale.y;
        pos=[phase?3.5+drift:1.9+drift,1.25*scale+.7,Math.max(phase?7.5:8.6,scale*4.4)];target=[1.6,1.25*scale,0];
      }
      if(state.reveal?.revealed&&!active&&!reduced){pos=[.25,2.8,9.4];target=[0,1.65,0];}
      const widthFactor = Math.max(1, 0.98 / camera.aspect);
      camera.fov=active?frame.fov:36;
      camera.updateProjectionMatrix();
      camera.position.set(pos[0], pos[1], pos[2] * widthFactor);
      camera.lookAt(...target);
      if(active&&!reduced)camera.rotation.z+=frame.roll;
      el.dataset.shot=active?frame.shot:'arena';
      el.dataset.progress=frame?.progress.toFixed(4)||'0';
      if (active && !reduced) {
        camera.position.x += Math.sin(now * 0.09) * frame.impact * 0.1;
        camera.position.y += Math.cos(now * 0.11) * frame.impact * 0.065;
      }
      burst.material.uniforms.uTime.value = time;
      burst.material.uniforms.uStrength.value =
        active && frame.revealed && !frame.spectacle
          ? (a.finisher
              ? frame.impact * 0.65
              : frame.impact * 0.35) *
            (1 - frame.returnHome)
          : 0;
      burst.material.uniforms.uColor.value.set(a?.color || "#83ffd6");
      if (active && a.finisher && frame.revealed) {
        const tint = new THREE.Color(a.color);
        scene.background.lerp(tint, frame.impact * 0.6);
        scene.fog.color.lerp(tint, frame.impact * 0.45);
        key.intensity = 2.4 + frame.impact * 4;
      } else key.intensity = 2.4;
      scene.fog=arenaFog;
      scene.background=arenaBackground;
      environment.update(
        time,
        state.enemyLevel,
        state.district,
        active ? frame : null,
        reduced,
        low,
        state.enemyAppearance?.lookSeed||0,
        state.bossPhase||0,
      );
      const loss=a?.outcome==='loss';
      const world=cinematicWorld.update({frame:active?frame:null,animation:a,time,low,reduced,attacker:loss?enemy:player,defender:loss?player:enemy});
      environment.setVisible?.(!world.hideEnvironment);
      if (!environment.setVisible) environment.root.visible=!world.hideEnvironment;
      if(world.hideEnvironment){scene.fog=null;scene.background=new THREE.Color(world.world==='void'?'#02010a':'#02030c');}
      el.dataset.spectacle=active?frame.spectacle?.kind||'none':'none';
      el.dataset.cinematicWorld=world.world||'arena';
      el.dataset.contactIndex=frame?.contactIndex??0;
      el.dataset.hitCount=frame?.hitCount??0;
      el.dataset.environment=environment.theme;
      el.dataset.worldTime=time.toFixed(2);
      film.render(low,time,active?frame.impact:0,state.district?.static||state.district?.anomaly==='Signal bleed');
      el.dataset.backdrop=environment.backdropReady?'loaded':'procedural';
      lastQualityLow=low;needsRedraw=false;
      if(loaded===5&&environment.ready!==false&&el.dataset.frameAsset!=='loaded'){
        // Models parsed is not the same as a human frame rendered. Wait for
        // shader preparation before enabling the first hand or starting an intro.
        el.dataset.frameAsset='loaded';props.onReady?.();
      }

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
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has('proof')){el.__captureRender=now=>{resize();render(now);};el.__captureState=()=>runtime.current;}
    el.dataset.frameAsset = "loading";
    el.dataset.meshQuality = "anatomical-human";
    raf = requestAnimationFrame(render);
    return () => {
      disposed = true;
      [...players,...enemies].forEach(f=>f.disposeAppearance?.());
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      combatEffects.dispose();
      cinematicWorld.dispose();
      const geometries = new Set(),
        materials = new Set(),
        skeletons = new Set(),
        textures = new Set();
      scene.traverse((o) => {
        if(o.isSkinnedMesh)skeletons.add(o.skeleton);
        if(o.isInstancedMesh)o.dispose();
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
      skeletons.forEach(s=>s.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      clothMaps.dispose();shadowMap.dispose();
      environment.dispose();
      film.dispose();
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
