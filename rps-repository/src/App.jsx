import React, { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Expand, Pause, Volume2, VolumeX } from "lucide-react";
import BattleStage from "./components/BattleStage";
import CombatConsole from "./components/CombatConsole";
import GameDialogs from "./components/GameDialogs";
import {
  WEAPONS,
  newRun,
  resolveTurn,
  chooseUpgrade,
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
import { attackPresentation } from "./game/cinematics";
import {
  startTraining,
  progressTraining,
  trainingDossier,
} from "./game/training";
import TrainingCoach from "./components/TrainingCoach";
import CharacterSelect from "./components/CharacterSelect";
import { fighterFor, rivalFighter } from "./game/fighters";
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
  const campaign = useRef(null);
  const [modal, setModal] = useState(null),
    [sound, setSound] = useState(
      () => safeRead("trinity-sound-v2", true) === true,
    ),
    [record, setRecord] = useState(() => loadRecords());
  const [storageWarning, setStorageWarning] = useState(false),
    [toast, setToast] = useState("");
  const timer = useRef(null),
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
  const [started, setStarted] = useState(false);
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
  const district = run.enemy.district;
  const { dossier: rivalDossier, ai: liveAi } = useEncounter(
    run.seed,
    run.level,
    preferences.liveDossiers && !training,
  );
  const dossier = training ? trainingDossier(training.step) : rivalDossier;
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
            ? "Heat cleared"
            : " +35 charge",
      );
      timer.current = setTimeout(() => commit(next), 650);
      return;
    }
    const loss = next.result.outcome === "loss",
      attacker = loss
        ? training?.step === 3
          ? "cinder"
          : rivalFighter(run.level).id
        : run.character;
    const cinematic = attackPresentation(
      loss ? next.result.enemyWeapon : hand,
      loss ? next.hp === 0 : next.phase === "upgrade",
      reducedMotion(),
      variant,
      attacker,
    );
    setAnimation({
      ...next.result,
      ...cinematic,
      finalHit: loss ? next.phase === "defeat" : next.phase === "upgrade",
      potentialDamage: loss
        ? next.result.incoming
        : damageFor(run, "win", attackStance),
      id: `${run.seed}-${run.level}-${next.turn}`,
    });
    playTone(loss ? next.result.enemyWeapon : hand, sound);
    playTone(
      cinematic.finisher ? "finisher" : next.result.outcome,
      sound,
      (cinematic.duration / 1000) * cinematic.impactAt,
    );
    timer.current = setTimeout(() => commit(next), cinematic.duration);
  };
  const engage = (choice = weapon) => {
    if (
      !started ||
      busyRef.current ||
      pending ||
      modal ||
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
        else if (!busyRef.current && run.phase === "ready") setModal("pause");
        return;
      }
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
  }, [modal, run.phase, sound, started, pending]);
  const advance = (id) => {
    setRun((current) => chooseUpgrade(current, id));
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
    clearTimeout(timer.current);
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
        <main className="game-surface">
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
          />
          <header className="game-tools">
            <button
              className="menu-button"
              aria-label="Pause game"
              disabled={busy}
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
          {training && (
            <TrainingCoach
              training={training}
              busy={busy}
              onExit={leaveTraining}
            />
          )}
          <CombatConsole
            run={run}
            setRun={setRun}
            weapon={weapon}
            setWeapon={setWeapon}
            pending={pending}
            chooseAction={chooseAction}
            stance={stance}
            setStance={setStance}
            busy={busy}
            modal={modal}
            sound={sound}
            engage={engage}
            notify={notify}
            onGuide={() => setModal("guide")}
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
          <div className="title-art" />
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
    </div>
  );
}
