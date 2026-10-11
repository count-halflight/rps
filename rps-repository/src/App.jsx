import React, { useEffect, useRef, useState, Suspense, lazy } from "react";
import { ArrowUpRight, Expand, Pause, Volume2, VolumeX } from "lucide-react";
import BattleStage from "./components/BattleStage";
import CombatConsole from "./components/CombatConsole";
import GameDialogs from "./components/GameDialogs";
import {
  WEAPONS,
  newRun,
  resolveTurn,
  chooseReward,
  chooseRoute,
  loadSave,
  damageFor,
  openingFor,
  useEarnedItem,
  scanSignal,
} from "./game/engine";
import {
  unlockAudio,
  playTone,
  configureAudio,
  setAmbience,
  setBattleAudio,
  playChoreography,
  playSceneMomentAudio,
  cancelChoreography,
  playStinger,
  setBossAudio,
} from "./game/audio";
import {
  FRAME_FINISHES,
  loadPreferences,
  finishUnlocked,
} from "./game/preferences";
import SettingsDialog from "./components/SettingsDialog";
import useEncounter from "./game/useEncounter";
import { CONTROLS } from "./game/controls";
import { dailyDate } from "./game/daily";
import { attackPresentation, cinematicCue } from "./game/cinematics";
import { createQteTrack, expireQtes, pressQte, qteScore, qteCharge } from './game/qte.js';
import CinematicQte from './components/CinematicQte.jsx';
import {
  startTraining,
  progressTraining,
  trainingDossier,
} from "./game/training";
import TrainingCoach from "./components/TrainingCoach";
import CharacterSelect from "./components/CharacterSelect";
import RunFlow from './components/RunFlow';
import EncounterIntro from './components/EncounterIntro';
import { roomAction } from './game/routes.js';
import { phaseFor } from './game/rivals.js';
import { rivalProfile, visualPhaseFor } from './game/rivalProfile.js';
import { sceneMomentPresentation } from './game/sceneMoments.js';
import { combatMomentPresentation } from './game/combatMoments.js';
import { fighterFor, rivalFighter } from "./game/fighters";
const HeroArena=lazy(()=>import("./components/Arena"));
const CinematicLab=lazy(()=>import('./components/CinematicLab.jsx'));
function safeRead(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function loadRecords() {
  const value = safeRead("trinity-record-v1", {});
  return {
    ...Object.fromEntries(
      ["level", "credits", "runs", "combo"].map((key) => [
        key,
        Number.isFinite(value?.[key]) && value[key] >= 0 ? value[key] : 0,
      ]),
    ),
    dailyDate: typeof value?.dailyDate === "string" ? value.dailyDate : null,
    dailyLevel:
      Number.isFinite(value?.dailyLevel) && value.dailyLevel >= 0
        ? value.dailyLevel
        : 0,
  };
}
function GameApp() {
  const [run, setRun] = useState(() => {
    try {
      return loadSave(localStorage) || newRun();
    } catch {
      return newRun();
    }
  });
  const [weapon, setWeapon] = useState("rock"),
    [stance, setStance] = useState("strike"),
    [busy, setBusy] = useState(false),
    [animation, setAnimation] = useState(null);
  const [pending, setPending] = useState(null),
    [selection, setSelection] = useState(null);
  const selectedRun = useRef({});
  const [training, setTraining] = useState(null);
  const [entrance,setEntrance]=useState(null);
  const introTimer=useRef(null),queuedHand=useRef(null);
  const campaign = useRef(null);
  const [modal, setModal] = useState(null),
    [sound, setSound] = useState(
      () => safeRead("trinity-sound-v2", true) === true,
    ),
    [record, setRecord] = useState(() => loadRecords());
  const [storageWarning, setStorageWarning] = useState(false),
    [toast, setToast] = useState("");
  const timer = useRef(null),
    qteTimers = useRef([]),
    qteState = useRef(null),
    toastTimer = useRef(null),
    busyRef = useRef(false),
    action = useRef(null);
  const [preferences, setPreferences] = useState(() => {
    try {
      return loadPreferences(localStorage);
    } catch {
      return loadPreferences({ getItem: () => null });
    }
  });
  const [started, setStarted] = useState(false),[arenaReady,setArenaReady]=useState(false);
  const playback = useRef(null);
  const [finaleViews, setFinaleViews] = useState(() => safeRead('trinity-finales-seen-v1', {}));
  const [armorPresentation, setArmorPresentation] = useState(() => safeRead('trinity-presentation-armor-v1', {key:null,count:0}));
  const armorKey=`${run.seed}:${run.level}`;
  const brokenPlates=armorPresentation.key===armorKey?Math.max(0,Math.min(6,Number(armorPresentation.count)||0)):0;
  const presentationRival = training ? run.enemy.rival : rivalProfile(run.seed, run.level, run.enemy, run.character);
  useEffect(()=>{if(!started)setArenaReady(false);},[started]);
  const [hasSave, setHasSave] = useState(() => {
    try {
      return Boolean(loadSave(localStorage));
    } catch {
      return false;
    }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  const paused = Boolean(modal) || !started;
  useEffect(()=>{
    if(!started||!arenaReady||training||run.phase!=='ready'||run.encounterSeen)return;
    const reduced=preferences.motion==='reduced'||matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sequenceId = presentationRival.model === 'bulwark' ? 'bulwark.intro'
      : !run.enemy.boss ? `entrance.${presentationRival.character || run.character}` : null;
    const duration = sequenceId ? sceneMomentPresentation(sequenceId, { reduced }).duration : reduced ? 700 : 5000;
    setEntrance({kind:'encounter',id:`intro-${run.seed}-${run.level}`,sequenceId,duration,reduced,startedAt:performance.now()});
    if (!sequenceId) playStinger(run.enemy.rival,sound);
    introTimer.current=setTimeout(()=>{setEntrance(null);setRun(r=>({...r,encounterSeen:true}));},duration);
    return()=>clearTimeout(introTimer.current);
  },[started,arenaReady,Boolean(training),run.level,run.phase,run.encounterSeen]);
  useEffect(() => {
    if (!entrance?.sequenceId) return;
    const owner = entrance.id;
    playSceneMomentAudio(entrance.sequenceId, { id: owner, startedAt: entrance.startedAt,
      reduced: entrance.reduced, short: entrance.short, sound });
    return () => cancelChoreography(owner);
  }, [entrance?.id, sound]);
  const finishEntrance=()=>{clearTimeout(introTimer.current);setEntrance(null);setRun(r=>({...r,encounterSeen:true}));};
  const finish =
    FRAME_FINISHES.find(
      (f) => f.id === preferences.skin && finishUnlocked(f, record.level),
    ) || FRAME_FINISHES[0];
  useEffect(() => {
    try {
      localStorage.setItem(
        "trinity-preferences-v1",
        JSON.stringify(preferences),
      );
    } catch {}
    configureAudio(preferences.volume, sound);
  }, [preferences, sound]);
  useEffect(() => {
    setAmbience(
      sound && preferences.music && !paused && run.phase === "ready",
      run.level,
    );
    return () => setAmbience(false);
  }, [sound, preferences.music, paused, run.level, run.phase]);
  useEffect(() => {
    setBossAudio(run.enemy.boss?phaseFor(run.enemy)+1:0, presentationRival.model || run.enemy.rival.id);
    setBattleAudio(
      run.enemy.hp / run.enemy.maxHp,
      run.hp / run.maxHp,
      busy && (animation?.tier >= 3 || animation?.finisher) ? animation : null,
    );
  }, [
    run.enemy.hp,
    run.enemy.maxHp,
    run.hp,
    run.maxHp,
    busy,
    animation?.id,
    sound,
    preferences.music,
    paused,
  ]);
  useEffect(()=>{
    if(!import.meta.env.DEV||!new URLSearchParams(location.search).has('proof'))return;
    const load=e=>{clearTimeout(timer.current);clearTimeout(introTimer.current);qteTimers.current.forEach(clearTimeout);qteState.current=null;playback.current=null;cancelChoreography();setRun(e.detail);setEntrance(null);setStarted(true);setSelection(null);setModal(null);setTraining(null);setBusy(false);busyRef.current=false;setPending(null);setAnimation(null);};
    window.addEventListener('trinity:proof-run',load);
    return()=>window.removeEventListener('trinity:proof-run',load);
  },[]);
  const district = run.enemy.district;
  const { dossier: rivalDossier, ai: liveAi } = useEncounter(
    run.seed,
    run.level,
    preferences.liveDossiers && !training,
  );
  const dossier = training ? trainingDossier(training.step) : {...rivalDossier,name:presentationRival.name,title:presentationRival.title,taunt:presentationRival.taunts?.[0] || presentationRival.taunt,story:presentationRival.lore || run.enemy.rival.lore};
  const ai = !training && liveAi;
  const overdriveLocked = run.charge < 40 || run.heat >= 75;
  useEffect(() => {
    if (training || (!started && !hasSave)) return;
    try {
      localStorage.setItem("trinity-save-v1", JSON.stringify(run));
    } catch {
      setStorageWarning(true);
    }
  }, [run, training, started, hasSave]);
  useEffect(() => {
    try {
      localStorage.setItem("trinity-sound-v2", JSON.stringify(sound));
    } catch {}
  }, [sound]);
  useEffect(() => {
    if (training) return;
    setRecord((previous) => {
      const updated = {
        ...previous,
        level: Math.max(previous.level, run.level),
        credits: Math.max(previous.credits, run.credits),
        combo: Math.max(previous.combo, run.bestCombo),
        ...(run.challenge === dailyDate()
          ? {
              dailyDate: run.challenge,
              dailyLevel: Math.max(
                previous.dailyDate === run.challenge ? previous.dailyLevel : 0,
                run.level,
              ),
            }
          : {}),
      };
      try {
        localStorage.setItem("trinity-record-v1", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [run.level, run.credits, run.bestCombo, run.challenge, Boolean(training)]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(toastTimer.current);
      clearTimeout(introTimer.current);
      qteTimers.current.forEach(clearTimeout);
      cancelChoreography();
    },
    [],
  );
  useEffect(() => {
    if (overdriveLocked && stance === "overdrive") setStance("strike");
  }, [overdriveLocked, stance]);
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };
  const commit = (next) => {
    const completed = playback.current;
    playback.current = null;
    cancelChoreography(completed?.animation.id);
    if (completed?.animation.momentId) setAnimation(null);
    if (completed?.animation.breaksPlate) {
      const value={key:armorKey,count:completed.animation.brokenPlates};
      setArmorPresentation(value);
      try { localStorage.setItem('trinity-presentation-armor-v1',JSON.stringify(value)); } catch {}
    }
    if (completed?.animation.finale) {
      setFinaleViews(views => {
        const updated = { ...views, [completed.animation.character]: (views[completed.animation.character] || 0) + 1 };
        try { localStorage.setItem('trinity-finales-seen-v1', JSON.stringify(updated)); } catch {}
        return updated;
      });
    }
    qteTimers.current.forEach(clearTimeout);
    if (qteState.current) {
      const charge = qteCharge(expireQtes(qteState.current.track, Infinity));
      if (charge && next.hp > 0) next = { ...next, charge: Math.min(100, next.charge + charge) };
      qteState.current = null;
    }
    if(!training&&next.enemy.boss&&next.enemy.hp>0&&visualPhaseFor(next.enemy)>visualPhaseFor(run.enemy)){
      const phase=visualPhaseFor(next.enemy);
      const sequenceId = presentationRival.model === 'bulwark' ? `bulwark.phase${phase}` : null;
      const duration=sequenceId ? sceneMomentPresentation(sequenceId,{reduced:reducedMotion()}).duration : reducedMotion()?700:3000;
      setEntrance({kind:'phase',phase,id:`phase-${next.level}-${next.turn}`,sequenceId,duration,reduced:reducedMotion(),startedAt:performance.now()});
      if (!sequenceId) playTone('finisher',sound);
      introTimer.current=setTimeout(()=>setEntrance(null),duration);
    }
    if (training) {
      const lesson = progressTraining(training, next);
      setTraining(lesson);
      setRun(lesson.run);
      if (lesson.step !== training.step && lesson.step !== 4) {
        setAnimation(null);
        setStance("strike");
      }
    } else setRun(next);
    setPending(null);
    if (!training && next.phase === 'defeat') {
      queuedHand.current=null;
      const defeat={...combatMomentPresentation('combat.defeat'),id:`defeat-${next.seed}-${next.level}-${next.turn}`,
        startedAt:performance.now(),outcome:'loss',character:next.character,playerCharacter:next.character,enemyCharacter:presentationRival.character,
        defeatedSide:'player',incoming:0,damage:0,healing:0,revealAt:0,impactAt:0,reduced:reducedMotion()};
      setAnimation(defeat);busyRef.current=true;setBusy(true);playChoreography(defeat,sound);
      timer.current=setTimeout(()=>{cancelChoreography(defeat.id);setAnimation(null);busyRef.current=false;setBusy(false);},defeat.duration);
      return;
    }
    busyRef.current = false;
    setBusy(false);
    const queued=queuedHand.current;queuedHand.current=null;if(queued&&next.phase==='ready'&&!next.result?.phaseChange)timer.current=setTimeout(()=>action.current(queued),80);
    if (next.phase === "upgrade" && !training) playTone("upgrade", sound);
  };
  const reducedMotion = () =>
    preferences.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const presentCombatMoment = (momentId, next, fields={}) => {
    busyRef.current=true;setBusy(true);setPending(null);
    const clip={...next.result,...combatMomentPresentation(momentId),...fields,
      id:`${momentId}-${run.seed}-${run.level}-${next.turn}`,startedAt:performance.now(),
      character:run.character,playerCharacter:run.character,enemyCharacter:presentationRival.character,reduced:reducedMotion(),
      revealAt:0,impactAt:momentId.startsWith('item.')?.42:momentId==='combat.clash'?.4:0};
    playback.current={next,animation:clip};setAnimation(clip);playChoreography(clip,sound);
    timer.current=setTimeout(()=>commit(next),clip.duration);
  };
  const perform = (hand, attackStance = "strike", variant = 0, item = null) => {
    const next = item
      ? useEarnedItem(run, hand, item)
      : resolveTurn(run, hand, attackStance);
    if (next === run) return;
    busyRef.current = true;
    setBusy(true);
    setPending(null);
    if (item) {
      presentCombatMoment('item.'+item,next,{actorSide:'player',outcome:'utility'});
      notify(
        item === "medkit"
          ? `+${next.result.healing} health`
          : item === "coolant"
            ? `−${run.heat-next.heat} heat`
            : `+${next.charge-run.charge} charge`,
      );
      return;
    }
    const loss = next.result.outcome === "loss",
      attacker = loss
        ? training?.step === 3
          ? "cinder"
        : presentationRival.character
        : run.character;
    const cinematic = attackPresentation(
      loss ? next.result.enemyWeapon : hand,
      loss ? next.hp === 0 : next.phase === "upgrade",
      reducedMotion(),
      variant,
      attacker,
      loss&&next.result.signature?`${run.enemy.rival.id}.signature`:null,
      0,
      {bossKill: !loss && next.phase === 'upgrade' && run.enemy.boss, short: preferences.cinematicLength === 'short', reduceFlashes: preferences.reduceFlashes},
    );
    const startedAt = performance.now();
    const qte = createQteTrack(cinematicCue(cinematic.sequenceId), cinematic.duration,
      preferences.cinematicQte && !cinematic.reduced && !loss && !training);
    const animationId = `${run.seed}-${run.level}-${next.turn}`;
    qteState.current = { id: animationId, startedAt, track: qte };
    qteTimers.current.forEach(clearTimeout);
    qteTimers.current = qte.map(cue => setTimeout(() => {
      const current = qteState.current;
      if (!current || current.id !== animationId) return;
      current.track = expireQtes(current.track, Math.max(cue.closesAt, performance.now() - current.startedAt));
      setAnimation(value => value?.id === animationId ? { ...value, qte: current.track, qteSuccess: qteScore(current.track) } : value);
    }, Math.max(0, cue.closesAt - (performance.now() - startedAt))));
    const attackAnimation = {
      ...next.result,
      ...cinematic,
      braced:loss&&attackStance==='guard',
      defeatedBoss:!loss&&next.phase==='upgrade'&&run.enemy.boss?presentationRival.model:null,
      finalHit: loss ? next.phase === "defeat" : next.phase === "upgrade",
      potentialDamage: loss
        ? next.result.incoming
        : damageFor(run, "win", attackStance),
      startedAt,
      qte,
      qteSuccess: 1,
      id: animationId,
      breaksPlate: !loss && next.result.outcome==='win' && attackStance==='overdrive' && run.enemy.ability?.id==='plating',
      brokenPlates: Math.min(6,brokenPlates+(!loss && next.result.outcome==='win' && attackStance==='overdrive' && run.enemy.ability?.id==='plating'?1:0)),
    };
    playback.current = { next, animation: attackAnimation };
    setAnimation(attackAnimation);
    playChoreography(attackAnimation,sound);
    if (preferences.haptics !== false) navigator.vibrate?.(20);
    if (!cinematic.tier && !cinematic.finisher) playTone(next.result.outcome, sound,
      (cinematic.duration / 1000) * cinematic.impactAt);
    timer.current = setTimeout(() => commit(next), cinematic.duration);
  };
  const skipAnimation = () => {
    const current = playback.current;
    if (!current || !busyRef.current || performance.now() - current.animation.startedAt < 2000) return;
    clearTimeout(timer.current);
    commit(current.next);
  };
  const respondQte = key => {
    const current = qteState.current;
    if (!current || !busyRef.current || modal) return;
    const response = pressQte(current.track, key, performance.now() - current.startedAt);
    current.track = response.track;
    if (!response.result) return;
    setAnimation(value => value?.id === current.id ? { ...value, qte: current.track, qteSuccess: qteScore(current.track) } : value);
    if (preferences.haptics !== false) navigator.vibrate?.(response.result.status === 'hit' ? [12,25,18] : 8);
    playTone(response.result.status === 'hit' ? 'qte-hit' : 'qte-miss', sound);
  };
  const engage = (choice = weapon) => {
    if(busyRef.current&&animation){queuedHand.current=choice;setWeapon(choice);if(preferences.haptics!==false)navigator.vibrate?.(12);return;}
    if (
      !started || !arenaReady ||
      busyRef.current ||
      pending ||
      modal ||
      entrance ||
      run.phase !== "ready"
    )
      return;
    const opening = openingFor(run, choice);
    if (!opening) return;
    setWeapon(choice);
    setAnimation(null);
    const revealStartedAt=performance.now();
    const revealState={...opening,startedAt:revealStartedAt,momentId:'combat.reveal',stage:'reveal',revealed:false};
    setPending(revealState);
    playChoreography({...combatMomentPresentation('combat.reveal'),...opening,id:`reveal-${run.seed}-${run.level}-${run.turn}`,
      startedAt:revealStartedAt,character:run.character,playerCharacter:run.character,enemyCharacter:presentationRival.character,
      playerHand:opening.playerWeapon,enemyHand:opening.enemyWeapon,reduced:reducedMotion()},sound);
    busyRef.current = true;
    setBusy(true);
    timer.current = setTimeout(
      () => {
        setPending({ ...revealState, revealed: true });
        timer.current = setTimeout(() => {
          if (opening.outcome === "win") {
            setPending({ ...opening, stage: "action", revealed: true });
            busyRef.current = false;
            setBusy(false);
          } else if (opening.outcome === "draw") {
            presentCombatMoment('combat.clash',resolveTurn(run,choice,stance),{outcome:'draw'});
          } else perform(choice, stance, run.turn % 3);
        }, 300);
      },
      900,
    );
  };
  const chooseAction = (index, item = null) => {
    if (busyRef.current || pending?.stage !== "action" || modal) return;
    perform(
      pending.playerWeapon,
      ["strike", "guard", "overdrive"][index] || "strike",
      index || 0,
      item,
    );
  };
  action.current = engage;
  const readHand = () => {
    if (busyRef.current || pending || modal || entrance || !arenaReady || run.phase !== 'ready') return;
    const next=scanSignal(run);
    if(next===run)return;
    presentCombatMoment('item.scan',next,{actorSide:'player',scannedHand:next.scanned,outcome:'utility',
      damage:0,incoming:0,healing:0,enemyHealing:0});
  };
  useEffect(() => {
    const handle = (e) => {
      if (e.target.matches("input,textarea,select") || e.repeat) return;
      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        fullscreen();
        return;
      }
      if (e.key === CONTROLS.pauseKey) {
        e.preventDefault();
        if (modal) setModal(null);
        else if (!busyRef.current && !entrance && run.phase === "ready") setModal("pause");
        return;
      }
      if (busyRef.current && animation?.qte?.length && ['1','2','3'].includes(e.key)) {
        e.preventDefault(); respondQte(e.key); return;
      }
      if(busyRef.current&&animation&&['1','2','3'].includes(e.key)){queuedHand.current=WEAPONS[Number(e.key)-1].id;return;}
      if (!started || modal || run.phase !== "ready" || busyRef.current) return;
      if (CONTROLS.weaponKeys.includes(e.key)) {
        if (pending?.stage === "action") {
          chooseAction(CONTROLS.weaponKeys.indexOf(e.key));
          return;
        }
        setWeapon(WEAPONS[CONTROLS.weaponKeys.indexOf(e.key)].id);
        playTone("select", sound);
      }
      if (CONTROLS.engageCodes.includes(e.code)) {
        if (e.target.closest("button")) return;
        e.preventDefault();
        action.current?.();
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [modal, run.phase, sound, started, pending, animation, entrance]);
  const advance = (id) => {
    setRun((current) => chooseReward(current, id));
    setAnimation(null);
    setPending(null);
    setStance("strike");
    playTone("upgrade", sound);
  };
  const begin = () => {
    configureAudio(preferences.volume, sound);
    unlockAudio();
    setStarted(true);
    setHasSave(true);
  };
  const selectFighter = () => {
    configureAudio(preferences.volume, sound);
    unlockAudio();
    setArmorPresentation({key:null,count:0});
    try { localStorage.removeItem('trinity-presentation-armor-v1'); } catch {}
    setRun(
      newRun(
        selectedRun.current.seed,
        selectedRun.current.challenge,
        selection,
      ),
    );
    setHasSave(true);
    setSelection(null);
    setStarted(true);
    setPending(null);
    setAnimation(null);
  };
  const train = () => {
    clearTimeout(introTimer.current);setEntrance(null);
    begin();
    if (busyRef.current) return;
    if (!training) campaign.current = run;
    const lesson = startTraining();
    setSelection(null);
    setPending(null);
    setTraining(lesson);
    setRun(lesson.run);
    setWeapon("rock");
    setStance("strike");
    setAnimation(null);
    setModal(null);
  };
  const leaveTraining = () => {
    if (busyRef.current || !training) return;
    setRun(campaign.current || newRun());
    setTraining(null);
    setPending(null);
    setAnimation(null);
    setWeapon("rock");
    setStance("strike");
    setModal(null);
  };
  const restart = (seed, challenge = null) => {
    playback.current=null;queuedHand.current=null;cancelChoreography();
    clearTimeout(introTimer.current);setEntrance(null);
    clearTimeout(timer.current);
    qteTimers.current.forEach(clearTimeout); qteState.current = null;
    busyRef.current = false;
    setBusy(false);
    selectedRun.current = { seed, challenge };
    setSelection(run.character || "echo");
    setStarted(false);
    setPending(null);
    setAnimation(null);
    setWeapon("rock");
    setStance("strike");
    setModal(null);
    setRecord((r) => {
      const next = { ...r, runs: r.runs + 1 };
      try {
        localStorage.setItem("trinity-record-v1", JSON.stringify(next));
      } catch {}
      return next;
    });
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      notify("Fullscreen is unavailable in this browser.");
    }
  };
  return (
    <div
      className={`app-shell ${preferences.motion === "reduced" ? "reduced-motion" : ""} ${training ? "is-training" : ""}`}
      style={{
        "--district-color": district.color,
        "--district-hue": `${((run.level - 1) % 6) * 38}deg`,
      }}
    >
      {started && (
        <main className={`game-surface ${entrance?'is-introducing':''} ${busy && animation?.finale?'is-finale':''}`}>
          <BattleStage
            run={run}
            presentationRival={presentationRival}
            brokenPlates={brokenPlates}
            weapon={weapon}
            animation={animation}
            pending={pending}
            busy={busy}
            paused={paused}
            dossier={dossier}
            preferences={preferences}
            finish={finish}
            entrance={entrance}
            onSkipAnimation={skipAnimation}
            finaleSeen={Boolean(finaleViews[animation?.character])}
            onReady={()=>setArenaReady(true)}
            onLoading={()=>setArenaReady(false)}
          />
          <header className="game-tools">
            <button
              className="menu-button"
              aria-label="Pause game"
              disabled={busy||Boolean(entrance)}
              onClick={() => setModal("pause")}
            >
              <Pause size={18} /> <span>Menu</span>
            </button>
            <div className="hud-tools-right">
              <button
                className="sound-button"
                aria-label={sound ? "Mute sound" : "Enable sound"}
                onClick={() => {
                  configureAudio(preferences.volume, !sound);
                  unlockAudio();
                  setSound(!sound);
                }}
              >
                {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{sound ? "Sound on" : "Sound off"}</span>
              </button>
              <button
                className="fullscreen-button"
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
                onClick={fullscreen}
              >
                <Expand size={19} />
                <span>{isFullscreen ? "Windowed" : "Fullscreen"}</span>
              </button>
            </div>
          </header>
          {busy && animation && <CinematicQte animation={animation} onPress={respondQte} />}
          {training && (
            <TrainingCoach
              training={training}
              busy={busy}
              onExit={leaveTraining}
            />
          )}
          <EncounterIntro entrance={entrance} run={run} presentationRival={presentationRival} preferences={preferences} onSkip={finishEntrance}/>
          <CombatConsole
            run={run}
            setRun={setRun}
            weapon={weapon}
            setWeapon={setWeapon}
            pending={pending}
            chooseAction={chooseAction}
            stance={stance}
            setStance={setStance}
            busy={busy || !arenaReady}
            modal={modal||entrance}
            sound={sound}
            engage={engage}
            notify={notify}
            onGuide={() => {if (!busyRef.current && !pending && !entrance) setModal("guide");}}
            onScan={readHand}
          />
          {storageWarning && (
            <span className="save-warning">
              Progress could not save on this device.
            </span>
          )}
        </main>
      )}
      {selection && (
        <CharacterSelect
          selected={selection}
          setSelected={setSelection}
          preferences={preferences}
          onStart={selectFighter}
          onBack={() => {
            setSelection(null);
            setStarted(false);
          }}
        />
      )}
      {!started && !selection && (
        <div className="title-screen">
          <div className="title-art"><Suspense fallback={null}><HeroArena character="echo" previewSingle weapon="scissors" enemyLevel={1} district={run.enemy.district} quality={preferences.quality} reducedMotion={preferences.motion==='reduced'} titleHero/></Suspense></div>
          <div className="title-content">
            <p className="title-credit">a game by Halflight</p>
            <h1>
              Trinity<span>afterlight</span>
            </h1>
            <p className="title-tagline">Win the hand. Pick your attack.</p>
            <button
              className="start-button"
              onClick={() => {
                if (hasSave) begin();
                else {
                  selectedRun.current = {
                    seed: run.seed,
                    challenge: run.challenge,
                  };
                  setSelection(run.character || "echo");
                }
              }}
            >
              {hasSave ? "Continue" : "Play"}
              <ArrowUpRight size={23} />
            </button>
            {hasSave && (
              <button className="new-game-title" onClick={() => restart()}>
                New game · choose a fighter
              </button>
            )}
            <button className="training-start" onClick={train}>
              Learn to fight <span>Optional tutorial</span>
            </button>
            <div className="title-options">
              <button onClick={() => setSound(!sound)}>
                {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}{" "}
                {sound ? "Sound on" : "Sound off"}
              </button>
              <button onClick={() => setModal("settings")}>Settings</button>
              <button
                className="fullscreen-button"
                onClick={fullscreen}
                aria-label={
                  isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
                }
              >
                <Expand size={17} />
                {isFullscreen ? "Windowed" : "Fullscreen"}
              </button>
            </div>
            <small className="title-best">
              {record.level > 1
                ? `Personal best: floor ${record.level}`
                : "Rock · paper · scissors · survive"}
            </small>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {modal === "settings" && (
        <SettingsDialog
          preferences={preferences}
          setPreferences={setPreferences}
          sound={sound}
          setSound={(value) => {
            setSound(value);
            playTone("select", value);
          }}
          onClose={() => setModal(null)}
        />
      )}
      <GameDialogs
        modal={modal}
        setModal={setModal}
        run={run}
        record={record}
        dossier={dossier}
        ai={ai}
        busy={busy || !started}
        advance={advance}
        restart={restart}
        preferences={preferences}
        setPreferences={setPreferences}
        onFullscreen={fullscreen}
        isFullscreen={isFullscreen}
        onTraining={train}
        training={Boolean(training)}
      />
      {started&&!training&&<RunFlow run={run} onRoute={id=>{setRun(r=>chooseRoute(r,id));setAnimation(null);setPending(null);playTone('engage',sound);}} onRoom={id=>{setRun(r=>roomAction(r,id));playTone('upgrade',sound);}}/>}
    </div>
  );
}

export default function App() {
  const isLab = () => location.hash === '#/lab' || new URLSearchParams(location.search).get('lab') === '1';
  const [lab, setLab] = useState(isLab);
  useEffect(() => {
    const update = () => setLab(isLab());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return lab ? <Suspense fallback={<div className="scene-loading">Opening the Cinematic Lab</div>}><CinematicLab /></Suspense> : <GameApp />;
}
