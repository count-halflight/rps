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
import { preloadReflectionAssets, reflectionAssetsReady } from './reflectionAssets.js';
import { createLabOverlays } from './labOverlays.js';
import { combatMomentById, evaluateCombatMoment } from '../game/combatMoments.js';
import { evaluateSceneMoment, sceneMomentById } from '../game/sceneMoments.js';
import { estimateSceneDraws, selectLargestShadowCasters, FILM_POST_DRAWS, FILM_LIGHT_POST_DRAWS, SCENE_DRAW_BUDGET } from './renderBudget.js';
const FIGHTER_HEIGHTS = Object.freeze({echo:1.72,cinder:1.90,nyx:1.82,vex:1.70,kuro:1.88});
const BOSS_HEIGHTS = Object.freeze({'crucible-9':2.5,sable:2.1,bulwark:2.2,redline:1.85,cipher:2.0,onyx:1.92});
const smoothArrow = (progress, hit, i, count) =>
  Math.max(
    0,
    Math.min(1, (progress - (hit - 0.25 + (i / count) * 0.12)) / 0.25),
  );
export default function Arena(props) {
  const host = useRef(null),
    runtime = useRef(props),
    retryAssets = useRef(null),
    [failed, setFailed] = useState(false);
  runtime.current = props;
  useEffect(() => {
    const el = host.current;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        preserveDrawingBuffer:props.labTime !== undefined || (import.meta.env.DEV&&new URLSearchParams(location.search).has('proof')),
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      props.onReady?.({visuals:false});
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#11171b");
    scene.fog = new THREE.FogExp2("#152024", 0.045);
    const arenaFog = scene.fog;
    const arenaBackground = scene.background;
    const hemi=new THREE.HemisphereLight('#a9bdc3','#16100e',.85);
    scene.add(hemi);
    const key = new THREE.DirectionalLight("#ffe3cb", 2.4);
    key.position.set(-2, 6, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(512, 512);
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
    const fighterRims=[new THREE.PointLight('#83ffd6',1.7,5),new THREE.PointLight('#c24791',1.7,5)];
    scene.add(...fighterRims);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 90),
      environment = createEnvironment(scene),
      film = createFilmRenderer(renderer, scene, camera),
      clothMaps = createClothMaps();
    const combatEffects = createCombatEffects(scene);
    const cinematicWorld = createCinematicWorld(scene);
    const labOverlays = createLabOverlays(scene);
    let labOverride = null;
    let lastLabSignature = null;
    let lastFilmOptions = {};
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
          for(const fighter of [players[i],enemies[i]]) {
            const masses=[];
            fighter.root.traverse(o=>{if(o.isMesh){o.castShadow=false;if(o.isSkinnedMesh)masses.push(o);}});
            masses.sort((a,b)=>b.geometry.attributes.position.count-a.geometry.attributes.position.count).slice(0,3).forEach(o=>{o.castShadow=true;});
            fighter.model.traverse(o=>{
            if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material]){
              m.envMapIntensity=.75;
              if(/jacket|trousers|Shirt/.test(m.name)){
                if(!m.roughnessMap)m.roughnessMap=clothMaps.roughness;
                if(!m.normalMap){m.normalMap=clothMaps.normal;m.normalScale=new THREE.Vector2(.26,.26);}
              }
            }
            });
          }
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
          props.onReady?.({visuals:false});
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
    let adaptiveTier = 'medium';
    let reflectionRequest = null, reflectionFailure = null, adaptiveAssetsRequested = false;
    let reflectionView = '', reflectionAllowed = true;
    let id,
      entranceId, entranceStarted = 0,
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
    const render = (now, manual = false) => {
      if(disposed)return;
      if(!manual)raf = requestAnimationFrame(render);
      const state = runtime.current;
      el.dataset.paused=String(Boolean(state.paused));
      el.dataset.visible=String(visible);
      if (!visible || state.paused) {
        lastTime = now;
        // A fullscreen or layout resize clears the drawing buffer. Restore
        // the frozen scene once, keeping the paused actors and clock still.
        if(visible&&needsRedraw){film.render(lastQualityLow,time,0,false,lastFilmOptions);needsRedraw=false;}
        return;
      }
      scene.fog=arenaFog;
      scene.background=arenaBackground;
      renderer.info.reset();
      const reduced =
        state.reducedMotion ||
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      const labTime = labOverride ?? state.labTime;
      if(labTime !== undefined && labTime !== null)time = labTime;
      else time += Math.max(0, (now - lastTime) / 1000);
      lastTime = now;
      const tier=state.quality === 'auto' ? adaptiveTier : state.quality || 'medium';
      const low=tier==='low',high=tier==='high';
      const reflectionTier=low?'light':high?'high':'medium';
      if(reflectionFailure&&(reflectionRequest!==reflectionTier||reflectionAssetsReady(reflectionTier))){
        reflectionFailure=null;retryAssets.current=null;setFailed(false);
      }
      if(!state.previewSingle&&!reflectionAssetsReady(reflectionTier)){
        if(reflectionRequest!==reflectionTier){
          reflectionRequest=reflectionTier;reflectionFailure=null;
          needsRedraw=true;
          el.dataset.reflectionAsset='loading';el.dataset.frameAsset='loading';
          state.onLoading?.();
          preloadReflectionAssets(reflectionTier).catch(error=>{
            const selected=runtime.current.quality==='auto'?adaptiveTier:runtime.current.quality||'medium';
            const selectedReflection=selected==='low'?'light':selected==='high'?'high':'medium';
            if(disposed||reflectionRequest!==reflectionTier||selectedReflection!==reflectionTier)return;
            reflectionFailure=error;el.dataset.reflectionAsset='failed';el.dataset.frameAsset='fallback';
            retryAssets.current=()=>{reflectionRequest=null;reflectionFailure=null;retryAssets.current=null;needsRedraw=true;setFailed(false);};
            setFailed(true);runtime.current.onReady?.({visuals:false});
          });
        }
        lastTime=now;
        return;
      }
      if(reflectionFailure)return;
      reflectionRequest=reflectionTier;
      el.dataset.reflectionAsset=state.previewSingle?'unused':'loaded';
      if(state.quality==='auto'&&!state.previewSingle&&!adaptiveAssetsRequested){
        adaptiveAssetsRequested=true;
        preloadReflectionAssets('light').catch(()=>{});
      }
      const labSignature=labTime===undefined||labTime===null?null:[
        labTime,tier,loaded,environment.ready,environment.backdropReady,state.animation,state.entrance,
        state.character,state.enemyCharacter,state.enemyLevel,state.enemyAppearance,state.district,
        state.reducedMotion,state.reduceFlashes,state.enemyHpRatio,state.playerHpRatio,
        state.labOverlays?.bones,state.labOverlays?.ik,state.labOverlays?.camera,state.labOverlays?.clip,
      ];
      if(!manual&&labSignature&&!needsRedraw&&lastLabSignature&&labSignature.every((value,i)=>value===lastLabSignature[i])){
        frameStart=now;frames=0;el.dataset.fps='';
        return;
      }
      renderer.shadowMap.enabled = high;
      const ratio = import.meta.env.DEV&&new URLSearchParams(location.search).has('proof')?.65:low ? .85 : Math.min(devicePixelRatio, high?1.5:1);
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
        elapsed = labTime !== undefined && labTime !== null ? labTime : (now - started) / 1000;
      const playerHeight=FIGHTER_HEIGHTS[state.character]||1.72;
      const enemyHeight=state.enemyAppearance?.height || BOSS_HEIGHTS[state.enemyAppearance?.model] || (FIGHTER_HEIGHTS[enemyId]||1.88)*(state.enemyAppearance?.scale||1);
      const playerScale=playerHeight/(player.standingHeight||2.1);
      const enemyScale=enemyHeight/(enemy.standingHeight||2.1);
      const actorMetrics=a?.outcome==='loss'?{actorScale:enemyScale,targetScale:playerScale,actorHeight:enemyHeight,targetHeight:playerHeight,actorEyeHeight:(enemy.eyeHeight||1.9)*enemyScale,targetEyeHeight:(player.eyeHeight||1.9)*playerScale}:{actorScale:playerScale,targetScale:enemyScale,actorHeight:playerHeight,targetHeight:enemyHeight,actorEyeHeight:(player.eyeHeight||1.9)*playerScale,targetEyeHeight:(enemy.eyeHeight||1.9)*enemyScale};
      const combatId = combatMomentById(a?.momentId) ? a.momentId : state.reveal?.momentId;
      const combatFrame = combatMomentById(combatId) ? evaluateCombatMoment(combatId,
        a?.momentId ? elapsed : labTime ?? Math.max(0,now-(state.reveal?.startedAt??now))/1000,
        {...(a?.momentId ? a : state.reveal),reduced,playerCharacter:state.character,enemyCharacter:enemyId,
          playerHeight,enemyHeight,bossId:state.enemyAppearance?.model,playerHand:a?.playerWeapon||state.reveal?.playerWeapon,
          enemyHand:a?.enemyWeapon||state.reveal?.enemyWeapon}) : null;
      const combat=combatFrame && (!combatFrame.finished || labTime !== undefined && labTime !== null) ? combatFrame : null;
      const frame = a && !combat && !a.momentId ? cinematicFrame({...a,...actorMetrics}, elapsed) : null,
        active = frame && (frame.progress < 1 || labTime !== undefined && labTime !== null);
      const origin = a?.origin ?? 1.6;
      const inferredMoment = state.entrance?.sequenceId || (state.enemyAppearance?.model === 'bulwark'
        ? state.entrance?.kind === 'phase' ? `bulwark.phase${state.entrance.phase}` : 'bulwark.intro'
        : `entrance.${enemyId}`);
      const momentDefinition = state.entrance && !active && !combat && (state.entrance.sequenceId || !state.enemyAppearance?.boss || state.enemyAppearance?.model === 'bulwark') && sceneMomentById(inferredMoment);
      if (entranceId !== state.entrance?.id) {
        entranceId = state.entrance?.id;
        entranceStarted = state.entrance?.startedAt ?? now;
      }
      const momentElapsed = labTime ?? (now - entranceStarted) / 1000;
      const moment = momentDefinition ? evaluateSceneMoment(inferredMoment, momentElapsed, {
        reduced, short: state.entrance.short, phase: state.entrance.phase ?? state.bossPhase ?? 0,
        brokenPlates: state.brokenPlates || 0, side: state.entrance.side || 'enemy',
        actorHeight: state.entrance.side === 'player' ? playerHeight : enemyHeight,
        actorEyeHeight: state.entrance.side === 'player' ? actorMetrics.actorEyeHeight : (enemy.eyeHeight || 1.9) * enemyScale,
      }) : null;
      const staging = moment && (moment.progress < 1 || labTime !== undefined && labTime !== null);
      enemy.setAppearanceState?.({phase:state.bossPhase||0,brokenPlates:state.brokenPlates||0,heat:state.heat||0,
        signatureWarning:state.signatureWarning,scan:state.scan,lastHand:state.lastHand,...(staging ? moment.wardrobe : {})});
      if (state.enemyAppearance?.model === 'bulwark') enemy.setWeaponMode?.(
        staging ? moment.actor.weaponMode : (state.bossPhase || 0) > 0 ? 'gauntlets' : 'shield-hammer');
      el.dataset.cinematic = combat ? combat.momentId : active
        ? `${frame.weapon}-${a.finisher ? "final" : a.variant}`
        : "idle";
      player.root.position.set(
        -origin,
        reduced ? 0 : Math.sin(time * 2) * 0.015,
        0,
      );
      enemy.root.position.set(
        origin,
        reduced ? 0 : Math.sin(time * 1.8) * 0.015,
        0,
      );
      player.root.rotation.set(0, 0.95, 0);
      enemy.root.rotation.set(0, -0.95, 0);
      player.root.scale.setScalar(playerScale);
      enemy.root.scale.setScalar(enemyScale);
      player.root.visible=true;enemy.root.visible=!state.previewSingle;
      if(!active&&!combat&&!(staging&&moment.actorSide==='player')&&!state.previewSingle&&!state.reveal?.revealed)player.pose({reduced}, time);
      const personality=state.enemyAppearance?.personality;
      const idle=personality==='aggressor'?{torsoPitch:.16,handL:[.24,1.6,.36],handR:[-.24,1.58,.35]}:
        personality==='patient'?{handL:[.20,1.68,.36],handR:[-.20,1.64,.34],headPitch:-.04}:
        personality==='bluffer'?{headYaw:Math.sin(time*.65)*.12,handR:[-.32,1.38+Math.sin(time*.6)*.10,.22]}:
        personality==='gambler'?{torsoYaw:Math.sin(time*.8)*.12,headPitch:Math.sin(time*.7)*.04}:
        personality==='mimic'?{headYaw:Math.sin(time*.32)*.09}:{};
      if(!active&&!combat&&!(staging&&moment.actorSide==='enemy')&&!state.previewSingle&&!state.reveal?.revealed)enemy.pose(reduced?{reduced}:idle, time);
      player.setWeapon(state.weapon);
      enemy.setWeapon(a && active ? a.enemyWeapon : null);
      if (staging) {
        const actor = moment.actorSide === 'player' ? player : enemy;
        actor.root.position.fromArray(moment.root.pos);
        actor.root.rotation.set(0, moment.root.yaw, 0);
        if (moment.actor.weaponMode) actor.setWeaponMode?.(moment.actor.weaponMode);
        actor.pose(moment.actor, moment.physicalSeconds);
      }
      if (combat) {
        for (const [actor,poseFrame] of [[player,combat.player],[enemy,combat.enemy]]) {
          actor.root.position.fromArray(poseFrame.root.pos);actor.root.rotation.set(0,poseFrame.root.yaw,0);
          actor.pose(poseFrame.pose,combat.physicalSeconds);
        }
      }
      if(state.reveal?.revealed&&!combat){
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
      if (!active && !combat && state.phase === "upgrade") {
        enemy.pose({roll:-1.35},time);
        enemy.root.position.y = -.92;
      }
      if (!active && !combat && state.phase === "defeat") {
        player.pose({roll:1.35},time);
        player.root.position.y = -.92;
      }
      effects.visible = Boolean(
        active && frame.revealed && a.outcome !== "draw" && !frame.spectacle && !frame.tier,
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
        attacker.root.position.set(sign * (-origin + pose.x), pose.y, pose.z);
        attacker.root.visible=(pose.opacity??1)>.05;
        attacker.root.rotation.y = sign * Math.PI/2 + pose.yaw * sign;
        attacker.pose(pose, frame.physicalSeconds ?? time);
        defender.root.position.set(sign * (origin + frame.defender.x),frame.defender.y,frame.defender.z||0);
        defender.root.rotation.y = -sign * Math.PI/2 + (frame.defender.yaw||0)*sign;
        if (frame.defender.stretch) defender.root.scale.multiply(new THREE.Vector3(...frame.defender.stretch));
        defender.pose({...frame.defender,roll:(frame.defender.roll||0)*sign},frame.physicalSeconds ?? time);
        frame.contactPosition = defender.root.position.toArray();
        frame.contactPosition[1] += actorMetrics.targetHeight * .62;
        const color = a.color;
        bright.color.set(color);
        effects.position.x = sign * 2.1;
        if (frame.tier) combatEffects.reset();
        else combatEffects.update(attacker,frame,a,sign,time,low);
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
      const idleHeight=Math.max(1.15,enemyHeight*.59),idleDepth=Math.max(7.2,enemyHeight*3.05);
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
      if(combat){pos=combat.camera;target=combat.target;}
      else if(staging){pos=moment.camera;target=moment.target;}
      else if(state.entrance&&!active&&!reduced){
        pos=[1.9,enemyHeight*.65+.7,Math.max(7.2,enemyHeight*3.05)];target=[1.6,enemyHeight*.65,0];
      }
      if(state.reveal?.revealed&&!active&&!combat&&!reduced){pos=[.25,2.8,9.4];target=[0,1.65,0];}
      const widthFactor = Math.max(1, (frame?.cameraSafeWidth || 0.98) / camera.aspect);
      camera.fov=active?frame.fov:combat?combat.fov:staging?moment.fov:36;
      camera.updateProjectionMatrix();
      camera.position.set(pos[0], pos[1], pos[2] * widthFactor);
      camera.lookAt(...target);
      if(active&&!reduced)camera.rotation.z+=frame.roll;
      el.dataset.shot=active?frame.shot:combat?combat.cameraShot:staging?moment.cameraShot:'arena';
      el.dataset.progress=(frame?.progress??combat?.progress??(staging?moment.progress:0)).toFixed(4);
      if (active && !reduced) {
        camera.position.x += Math.sin(now * 0.09) * frame.impact * 0.1;
        camera.position.y += Math.cos(now * 0.11) * frame.impact * 0.065;
      }
      burst.material.uniforms.uTime.value = time;
      burst.material.uniforms.uStrength.value =
        active && frame.revealed && !frame.spectacle && !frame.tier
          ? (a.finisher
              ? frame.impact * 0.65
              : frame.impact * 0.35) *
            (1 - frame.returnHome)
          : 0;
      burst.material.uniforms.uColor.value.set(a?.color || "#83ffd6");
      if (active && a.finisher && frame.revealed) {
        const tint = new THREE.Color(a.color);
        scene.background.lerp(tint, frame.impact * 0.6);
        scene.fog?.color.lerp(tint, frame.impact * 0.45);
        key.intensity = 2.4 + frame.impact * 4;
      } else key.intensity = 2.4;
      scene.fog=arenaFog;
      scene.background=arenaBackground;
      const viewKey=`${state.enemyLevel}-${tier}`;
      if(reflectionView!==viewKey){reflectionView=viewKey;reflectionAllowed=true;}
      environment.setReflectionBudget?.(high&&reflectionAllowed);
      environment.update(
        time,
        state.enemyLevel,
        state.district,
        active ? frame : combat || (staging ? moment : null),
        reduced,
        low,
        state.enemyAppearance?.lookSeed||0,
        state.bossPhase||0,
        {rivalHpRatio:state.enemyHpRatio??1,playerHpRatio:state.playerHpRatio??1,defeatElapsed:frame?.dissolve?.progress?Math.max(0,elapsed-(a.duration/1000)*(a.impactAt||0)):null,reduceFlashes:state.reduceFlashes,reflections:high&&reflectionAllowed,freezeRain:frame?.finale?.rainFrozen,cinematic:frame||combat||staging?{lightDrain:(frame||combat||moment).lights?.drain||0,blackout:(frame||combat||moment).lights?.blackout||0,relightWave:(frame||combat||moment).lights?.relight||0,slice:frame?.finale?.id==='KURO-AF'?frame.finale.strike||0:0}:null},
      );
      const loss=a?.outcome==='loss';
      const world=cinematicWorld.update({frame:active?frame:null,combat,player,enemy,moment:staging?moment:null,animation:a?{...a,...actorMetrics}:null,time,low,quality:tier,reduced,reduceFlashes:state.reduceFlashes,attacker:staging?(moment.actorSide==='enemy'?enemy:player):loss?enemy:player,defender:staging?(moment.actorSide==='enemy'?player:enemy):loss?player:enemy,environment});
      if(labTime!==undefined&&labTime!==null)el.dataset.reflectionContacts=JSON.stringify(world.reflectionContacts||[]);
      const victim=loss?player:enemy;
      if(world.bossDissolve?.hide || (frame?.defender?.opacity??1)<.05)victim.root.visible=false;
      const life=environment.lightState;
      if(life){
        // Extinguishing the district is a staging cue. Keep the fighter lit
        // until the authored camera cut, including the defeat winner's rim.
        const cinematicSubject=Boolean(frame?.finale||frame?.tier>=4||staging||combat?.defeat);
        const blackout=frame?.finale?(frame.finale.blackout>.98?0:1):cinematicSubject?1:(life.blackout?0:1);
        const actorKey=frame?.finale?.time<9.3?.75:frame?.tier>=4?.85:staging?.55:combat?.defeat?.32*(1-(combat.fade||0)):0;
        hemi.intensity=Math.max(.85*life.arenaStrength,actorKey*.44)*blackout;
        key.intensity=Math.max((1.65+(frame?.impact||0)*.6)*life.arenaStrength,actorKey)*blackout;
        rim.intensity=Math.max(1.45*life.arenaStrength,cinematicSubject?.95:0)*blackout;
        scene.environmentIntensity=Math.max(.24*life.arenaStrength,actorKey*.18)*blackout;
        fighterRims.forEach((light,i)=>{const actor=i?enemy:player;light.position.copy(actor.root.position).add(new THREE.Vector3(0,(i?enemyHeight:playerHeight)*.88,-.65));light.color.set(i?state.enemyAppearance?.color||'#b6bfc4':fighterFor(state.character).color);
          const winner=combat?.lights?.silhouetteSide===(i?'enemy':'player');
          const strength=winner?combat.lights.silhouetteStrength:Math.max(life.fighterStrength,cinematicSubject?.95:0);
          light.intensity=strength*blackout*(i?1.5:1.5+(life.playerPulse||0)*.25);light.visible=actor.root.visible;});
      }
      environment.setVisible?.(!world.hideEnvironment);
      if (!environment.setVisible) environment.root.visible=!world.hideEnvironment;
      if(world.hideEnvironment){scene.fog=null;scene.background=new THREE.Color(world.world==='void'?'#02010a':'#02030c');}
      el.dataset.spectacle=active?frame.spectacle?.kind||'none':'none';
      el.dataset.cinematicWorld=world.world||'arena';
      el.dataset.contactIndex=frame?.contactIndex??combat?.contactIndex??moment?.contactIndex??0;
      el.dataset.hitCount=frame?.hitCount??0;
      el.dataset.actorHeight=playerHeight.toFixed(2);
      el.dataset.targetHeight=enemyHeight.toFixed(2);
      el.dataset.environment=environment.theme;
      el.dataset.worldTime=time.toFixed(2);
      labOverlays.update([player,enemy],a,state.labOverlays);
      const selectedShadows = high ? [
        ...selectLargestShadowCasters(player.root,3), ...selectLargestShadowCasters(enemy.root,3),
      ] : [];
      let drawEstimate = estimateSceneDraws(scene,{camera,shadows:high,post:low?FILM_LIGHT_POST_DRAWS:FILM_POST_DRAWS,reflection:environment.reflectionPlan?.()});
      if(drawEstimate.total > SCENE_DRAW_BUDGET && drawEstimate.reflection > 0){
        reflectionAllowed=false; environment.setReflectionBudget?.(false);
        drawEstimate=estimateSceneDraws(scene,{camera,shadows:high,post:low?FILM_LIGHT_POST_DRAWS:FILM_POST_DRAWS,reflection:{enabled:false}});
      }
      while(high && drawEstimate.baseTotal > SCENE_DRAW_BUDGET && selectedShadows.length){
        selectedShadows.pop().castShadow=false;
        drawEstimate=estimateSceneDraws(scene,{camera,shadows:high,post:FILM_POST_DRAWS,reflection:{enabled:false}});
      }
      el.dataset.estimatedDrawCalls=String(drawEstimate.total);
      el.dataset.shadowCasters=String(drawEstimate.casters);
      el.dataset.reflection=String(drawEstimate.reflection>0);
      environment.updateReflection?.(renderer,camera);
      const postEffects=world.postEffects||[];
      const effect=(name)=>Math.max(0,...postEffects.filter(fx=>fx.id===name).map(fx=>(fx.opacity??1)*Math.sin(Math.PI*(fx.phase??.5))));
      const rippleEffect=postEffects.find(fx=>fx.id==='SCREEN_RIPPLE');
      const focusPoint=new THREE.Vector3(...target);
      const projectedContact=new THREE.Vector3(...(frame?.contactPosition||[0,enemyHeight*.6,0])).project(camera);
      let motion=[0,0];
      if(high&&active&&!reduced&&frame.tier){
        const previous=cinematicFrame({...a,...actorMetrics},Math.max(0,elapsed-.016));
        motion=[Math.max(-.004,Math.min(.004,(frame.camera[0]-previous.camera[0])*.0015)),Math.max(-.003,Math.min(.003,(frame.camera[1]-previous.camera[1])*.0015))];
      }
      lastFilmOptions={quality:tier,reduced,reduceFlashes:state.reduceFlashes,playerHpRatio:state.playerHpRatio,
        grade:environment.grade,fade:Math.max(frame?.finale?.blackout||0,combat?.fade||0),invert:frame?.finale?.desaturate||0,
        focusDepth:focusPoint.sub(camera.position).dot(camera.getWorldDirection(new THREE.Vector3())),motion,
        warp:Math.max(frame?.finale?.id==='NYX-AF'?.7:0,effect('LENS_WARP')),warpCenter:[projectedContact.x*.5+.5,projectedContact.y*.5+.5],
        heat:effect('HEAT_DISTORT'),ripple:effect('SCREEN_RIPPLE'),ripplePhase:rippleEffect?.phase||0,
        chromaPulse:effect('CA_PULSE'),
        impactDark:state.reduceFlashes!==false?Math.max(effect('IMPACT_FRAME')*.12,effect('CA_PULSE')*.07):0};
      film.render(low,time,active?frame.impact:staging?moment.impact:0,state.district?.static||state.district?.anomaly==='Signal bleed',lastFilmOptions);
      el.dataset.backdrop=environment.backdropReady?'loaded':'procedural';
      lastQualityLow=low;needsRedraw=false;
      lastLabSignature=labSignature;
      if(loaded===5&&environment.ready!==false&&el.dataset.frameAsset!=='loaded'){
        // Models parsed is not the same as a human frame rendered. Wait for
        // shader preparation before enabling the first hand or starting an intro.
        el.dataset.frameAsset='loaded';runtime.current.onReady?.({visuals:true});
      }

      frames++;
      if (now - frameStart > 1500) {
        const fps = (frames * 1000) / (now - frameStart);
        el.dataset.fps = fps.toFixed(1);
        if (time > 3 && fps < 35 && !active && !combat && !staging && !state.reveal && reflectionAssetsReady('light')) adaptiveTier = 'low';
        frames = 0;
        frameStart = now;
      }
      el.dataset.drawCalls = renderer.info.render.calls;
      if(high&&renderer.info.render.calls>145)reflectionAllowed=false;
      el.dataset.triangles = renderer.info.render.triangles;
      el.dataset.renderQuality = tier;
    };
    if(props.labTime !== undefined)el.__lab={renderAt(seconds){labOverride=seconds;resize();render(performance.now(),true);},clearOverride(){labOverride=null;},capture(){return renderer.domElement.toDataURL('image/png');}};
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has('proof')){el.__captureRender=now=>{resize();render(now,true);};el.__captureState=()=>runtime.current;}
    el.dataset.frameAsset = "loading";
    el.dataset.meshQuality = "anatomical-human";
    raf = requestAnimationFrame(render);
    return () => {
      disposed = true;
      retryAssets.current=null;
      [...players,...enemies].forEach(f=>f.disposeAppearance?.());
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      combatEffects.dispose();
      cinematicWorld.dispose();
      labOverlays.dispose();
      delete el.__lab;
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
    <div className="three-arena" ref={host} aria-hidden={!failed}>
      {failed && (
        <div className="fallback-arena">
          <span>Visuals are unavailable. Combat controls remain playable.</span>
          {retryAssets.current&&<button type="button" onClick={()=>retryAssets.current?.()}>Retry visuals</button>}
        </div>
      )}
    </div>
  );
}
