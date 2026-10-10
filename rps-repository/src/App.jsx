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
} from "./game/engine";
import {
  unlockAudio,
  playTone,
  configureAudio,
  setAmbience,
  setBattleAudio,
  playChoreography,
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
import { fighterFor, rivalFighter } from "./game/fighters";
const HeroArena=lazy(()=>import("./components/Arena"));
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
export default function App() {
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
    setEntrance({kind:'encounter',id:`intro-${run.seed}-${run.level}`,duration:reduced?700:run.enemy.boss?5000:2300});
    playStinger(run.enemy.rival,sound);
    introTimer.current=setTimeout(()=>{setEntrance(null);setRun(r=>({...r,encounterSeen:true}));},reduced?700:run.enemy.boss?5000:2300);
    return()=>clearTimeout(introTimer.current);
  },[started,arenaReady,Boolean(training),run.level,run.phase,run.encounterSeen]);
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
    setBossAudio(run.enemy.boss?phaseFor(run.enemy)+1:0);
    setBattleAudio(
      run.enemy.hp / run.enemy.maxHp,
      run.hp / run.maxHp,
      busy && animation?.finisher ? animation : null,
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
    const load=e=>{clearTimeout(timer.current);clearTimeout(introTimer.current);qteTimers.current.forEach(clearTimeout);qteState.current=null;setRun(e.detail);setEntrance(null);setStarted(true);setSelection(null);setModal(null);setTraining(null);setBusy(false);busyRef.current=false;setPending(null);setAnimation(null);};
    window.addEventListener('trinity:proof-run',load);
    return()=>window.removeEventListener('trinity:proof-run',load);
  },[]);
  const district = run.enemy.district;
  const { dossier: rivalDossier, ai: liveAi } = useEncounter(
    run.seed,
    run.level,
    preferences.liveDossiers && !training,
  );
  const dossier = training ? trainingDossier(training.step) : {...rivalDossier,name:run.enemy.rival.name,title:run.enemy.rival.title,taunt:run.enemy.rival.taunt,story:run.enemy.rival.lore};
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
    qteTimers.current.forEach(clearTimeout);
    if (qteState.current) {
      const charge = qteCharge(expireQtes(qteState.current.track, Infinity));
      if (charge && next.hp > 0) next = { ...next, charge: Math.min(100, next.charge + charge) };
      qteState.current = null;
    }
    if(!training&&next.result?.phaseChange){
      const phase=next.result.phaseChange.to;
      setEntrance({kind:'phase',phase,id:`phase-${next.level}-${next.turn}`,duration:1800});
      playTone('finisher',sound);
      introTimer.current=setTimeout(()=>setEntrance(null),1800);
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
    busyRef.current = false;
    setBusy(false);
    const queued=queuedHand.current;queuedHand.current=null;if(queued&&next.phase==='ready'&&!next.result?.phaseChange)timer.current=setTimeout(()=>action.current(queued),80);
    if (next.phase === "upgrade" && !training) playTone("upgrade", sound);
  };
  const reducedMotion = () =>
    preferences.motion === "reduced" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const perform = (hand, attackStance = "strike", variant = 0, item = null) => {
    const next = item
      ? useEarnedItem(run, hand, item)
      : resolveTurn(run, hand, attackStance);
    if (next === run) return;
    busyRef.current = true;
    setBusy(true);
    setPending(null);
    if (item) {
      setAnimation(null);
      playTone("upgrade", sound);
      notify(
        item === "medkit"
          ? `+${next.result.healing} health`
          : item === "coolant"
            ? `−${run.heat-next.heat} heat`
            : `+${next.charge-run.charge} charge`,
      );
      timer.current = setTimeout(() => commit(next), 650);
      return;
    }
    const loss = next.result.outcome === "loss",
      attacker = loss
        ? training?.step === 3
          ? "cinder"
          : run.enemy.rival.character
        : run.character;
    const cinematic = attackPresentation(
      loss ? next.result.enemyWeapon : hand,
      loss ? next.hp === 0 : next.phase === "upgrade",
      reducedMotion(),
      variant,
      attacker,
      loss&&next.result.signature?`${run.enemy.rival.id}.signature`:null,
      (Math.floor((run.level - 1) / 3) + run.turn) % 2,
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
    setAnimation({
      ...next.result,
      ...cinematic,
      braced:loss&&attackStance==='guard',
      defeatedBoss:!loss&&next.phase==='upgrade'&&run.enemy.boss?run.enemy.rival.model:null,
      finalHit: loss ? next.phase === "defeat" : next.phase === "upgrade",
      potentialDamage: loss
        ? next.result.incoming
        : damageFor(run, "win", attackStance),
      startedAt,
      qte,
      qteSuccess: 1,
      id: animationId,
    });
    playChoreography(cinematic,sound);
    navigator.vibrate?.(20);
    if (!cinematic.finisher) playTone(next.result.outcome, sound,
      (cinematic.duration / 1000) * cinematic.impactAt);
    timer.current = setTimeout(() => commit(next), cinematic.duration);
  };
  const respondQte = key => {
    const current = qteState.current;
    if (!current || !busyRef.current || modal) return;
    const response = pressQte(current.track, key, performance.now() - current.startedAt);
    current.track = response.track;
    if (!response.result) return;
    setAnimation(value => value?.id === current.id ? { ...value, qte: current.track, qteSuccess: qteScore(current.track) } : value);
    navigator.vibrate?.(response.result.status === 'hit' ? [12,25,18] : 8);
    playTone(response.result.status === 'hit' ? 'qte-hit' : 'qte-miss', sound);
  };
  const engage = (choice = weapon) => {
    if(busyRef.current&&animation){queuedHand.current=choice;setWeapon(choice);navigator.vibrate?.(12);return;}
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
    setPending({ ...opening, stage: "reveal", revealed: false });
    busyRef.current = true;
    setBusy(true);
    playTone("select", sound);
    timer.current = setTimeout(
      () => {
        setPending({ ...opening, stage: "reveal", revealed: true });
        playTone(opening.outcome === "win" ? "win" : "select", sound);
        timer.current = setTimeout(() => {
          if (opening.outcome === "win") {
            setPending({ ...opening, stage: "action", revealed: true });
            busyRef.current = false;
            setBusy(false);
          } else if (opening.outcome === "draw") {
            setAnimation(null);
            commit(resolveTurn(run, choice));
          } else perform(choice, stance, run.turn % 3);
        }, 450);
      },
      reducedMotion() ? 250 : 600,
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
        <main className={`game-surface ${entrance?'is-introducing':''}`}>
          <BattleStage
            run={run}
            weapon={weapon}
            animation={animation}
            pending={pending}
            busy={busy}
            paused={paused}
            dossier={dossier}
            preferences={preferences}
            finish={finish}
            entrance={entrance}
            onReady={()=>setArenaReady(true)}
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
          <EncounterIntro entrance={entrance} run={run} onSkip={finishEntrance}/>
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
