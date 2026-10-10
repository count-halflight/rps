import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Coins,
  Cpu,
  Crosshair,
  Expand,
  Layers3,
  SlidersHorizontal,
  Target,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import BattleStage from "./components/BattleStage";
import CombatConsole from "./components/CombatConsole";
import GameDialogs from "./components/GameDialogs";
import { pad } from "./components/ui";
import {
  WEAPONS,
  newRun,
  resolveTurn,
  chooseUpgrade,
  loadSave,
  damageFor,
} from "./game/engine";
import {
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
  const [training, setTraining] = useState(null);
  const campaign = useRef(null);
  const [modal, setModal] = useState(null),
    [sound, setSound] = useState(
      () => safeRead("trinity-sound", false) === true,
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
  const paused = Boolean(modal);
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
    if (training) return;
    try {
      localStorage.setItem("trinity-save-v1", JSON.stringify(run));
    } catch {
      setStorageWarning(true);
    }
  }, [run, training]);
  useEffect(() => {
    try {
      localStorage.setItem("trinity-sound", JSON.stringify(sound));
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
  const engage = () => {
    if (busyRef.current || modal || run.phase !== "ready") return;
    if (stance === "overdrive" && overdriveLocked) return;
    const next = resolveTurn(run, weapon, stance);
    const cinematic = attackPresentation(
      weapon,
      run.enemy.hp <= damageFor(run, "win", stance),
      preferences.motion === "reduced" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    busyRef.current = true;
    setBusy(true);
    setAnimation({
      ...next.result,
      ...cinematic,
      finalHit: next.phase === "upgrade",
      potentialDamage: damageFor(run, "win", stance),
      id: `${run.seed}-${run.level}-${next.turn}`,
    });
    playTone("engage", sound);
    playTone(
      cinematic.finisher && next.phase === "upgrade"
        ? "finisher"
        : next.result.outcome,
      sound,
      (cinematic.duration / 1000) * (cinematic.finisher ? 0.43 : 0.4),
    );
    timer.current = setTimeout(() => {
      if (training) {
        const lesson = progressTraining(training, next);
        setTraining(lesson);
        setRun(lesson.run);
        if (lesson.step !== training.step && lesson.step !== 4) {
          setAnimation(null);
          setStance("strike");
        }
      } else setRun(next);
      busyRef.current = false;
      setBusy(false);
      if (next.phase === "upgrade" && !training) playTone("upgrade", sound);
    }, cinematic.duration);
  };
  action.current = engage;
  useEffect(() => {
    const handle = (e) => {
      if (e.target.matches("input,textarea,select") || e.repeat) return;
      if (e.key === CONTROLS.pauseKey) {
        e.preventDefault();
        if (modal) setModal(null);
        else if (!busyRef.current && run.phase === "ready") setModal("pause");
        return;
      }
      if (modal || run.phase !== "ready" || busyRef.current) return;
      if (CONTROLS.weaponKeys.includes(e.key)) {
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
  }, [modal, run.phase, sound]);
  const advance = (id) => {
    setRun((current) => chooseUpgrade(current, id));
    setAnimation(null);
    setStance("strike");
    playTone("upgrade", sound);
  };
  const train = () => {
    if (busyRef.current) return;
    if (!training) campaign.current = run;
    const lesson = startTraining();
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
    setAnimation(null);
    setWeapon("rock");
    setStance("strike");
    setModal(null);
  };
  const restart = (seed, challenge = null) => {
    clearTimeout(timer.current);
    busyRef.current = false;
    setBusy(false);
    setRun(newRun(seed, challenge));
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
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setModal(null);
          }}
          aria-label="Trinity circuit"
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            trinity<span className="brand-dot">.</span>
          </span>
          <span className="brand-edition">afterlight</span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={!modal ? "nav-link active" : "nav-link"}
            onClick={() => setModal(null)}
          >
            <Crosshair size={15} />
            <span>The circuit</span>
          </button>
          <button
            className={`nav-link ${modal === "archive" ? "active" : ""}`}
            onClick={() => setModal("archive")}
          >
            <Layers3 size={15} />
            <span>Your archive</span>
          </button>
          <button
            className={`nav-link ${modal === "guide" ? "active" : ""}`}
            onClick={() => setModal("guide")}
          >
            <BookOpen size={15} />
            <span className="desktop-nav-label">Field guide</span>
            <span className="mobile-nav-label">Guide</span>
          </button>
        </nav>
        <div className="header-tools">
          <button
            className="local-link"
            onClick={() => setModal("dossier")}
            title="Read the rival dossier"
          >
            <i />
            {ai ? "Live transmission" : "Local link"}
          </button>
          <span className="tool-divider" />
          <button
            className="icon-button"
            aria-label={sound ? "Mute sound" : "Enable sound"}
            title={sound ? "Mute sound" : "Enable sound"}
            onClick={() => {
              setSound(!sound);
              playTone("select", !sound);
            }}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            className="icon-button settings-button"
            aria-label="Open settings"
            title="Settings"
            onClick={() => setModal("settings")}
          >
            <SlidersHorizontal size={18} />
          </button>
          <button
            className="icon-button fullscreen-button"
            aria-label="Toggle fullscreen"
            title="Fullscreen"
            onClick={fullscreen}
          >
            <Expand size={18} />
          </button>
        </div>
      </header>
      <main>
        {training ? (
          <TrainingCoach
            training={training}
            busy={busy}
            onExit={leaveTraining}
          />
        ) : (
          <section className="page-heading">
            <div>
              <p className="eyebrow">
                <span className="tiny-line" />
                {run.challenge ? "Today’s circuit" : "Undercity combat circuit"}
              </p>
              <h1>
                Outthink the machine<span>.</span>
              </h1>
              <p className="page-subtitle">
                Scrap-built frames. Borrowed instincts. A city with no bottom.
              </p>
              <button
                className="text-button tutorial-entry"
                onClick={train}
                disabled={busy}
              >
                <BookOpen size={13} /> Try the training circuit{" "}
                <ArrowUpRight size={13} />
              </button>
            </div>
            <div className="run-stats">
              <div>
                <span className="stat-label">
                  <Coins size={14} />
                  Run credits
                </span>
                <strong>
                  {run.credits.toLocaleString()}
                  <span> cr</span>
                </strong>
              </div>
              <span className="stat-divider" />
              <div>
                <span className="stat-label">
                  <Trophy size={14} />
                  Best descent
                </span>
                <strong>
                  {pad(record.level)}
                  <span> floors</span>
                </strong>
              </div>
            </div>
          </section>
        )}
        <BattleStage
          run={run}
          weapon={weapon}
          animation={animation}
          busy={busy}
          paused={paused}
          dossier={dossier}
          preferences={preferences}
          finish={finish}
          onPause={() => setModal("pause")}
          onDossier={() => setModal("dossier")}
        />
        <CombatConsole
          run={run}
          setRun={setRun}
          weapon={weapon}
          setWeapon={setWeapon}
          stance={stance}
          setStance={setStance}
          busy={busy}
          modal={modal}
          sound={sound}
          engage={engage}
          notify={notify}
          onGuide={() => setModal("guide")}
        />
        <section className="descent-strip">
          <div className="descent-title">
            <span className="descent-icon">
              <ArrowDownRight size={19} />
            </span>
            <div>
              <h3>Your descent</h3>
              <p>Every floor rewrites the rules.</p>
            </div>
          </div>
          <div className="floor-route">
            {Array.from({ length: 5 }, (_, i) => {
              const level = run.level + i;
              return (
                <div
                  key={level}
                  className={`floor-node ${i === 0 ? "current" : ""} ${level % 5 === 0 ? "apex" : ""}`}
                >
                  <span>
                    {level % 5 === 0 ? (
                      <Target size={15} />
                    ) : i === 0 ? (
                      <Crosshair size={15} />
                    ) : (
                      <span className="node-dot" />
                    )}
                  </span>
                  <div>
                    <b>{pad(level)}</b>
                    <small>
                      {i === 0
                        ? "Current"
                        : level % 5 === 0
                          ? "Apex"
                          : "Unknown"}
                    </small>
                  </div>
                  {i < 4 && <span className="route-line" />}
                </div>
              );
            })}
          </div>
          <div className="installed-mods">
            <Cpu size={16} />
            <span>
              {Object.values(run.upgrades).reduce((a, b) => a + b, 0)} augments
              installed
            </span>
            <button
              className="icon-button"
              onClick={() => setModal("archive")}
              aria-label="View installed augments"
            >
              <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <footer className="site-footer">
          <span>
            <span className="footer-mark">△</span>Instinct is human. The rest is
            machinery.
          </span>
          <span>
            {storageWarning
              ? "Progress saving unavailable"
              : "Progress saved on this device"}
            <i className="save-dot" />
          </span>
        </footer>
      </main>
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
        busy={busy}
        advance={advance}
        restart={restart}
        preferences={preferences}
        setPreferences={setPreferences}
        onTraining={train}
        training={Boolean(training)}
      />
    </div>
  );
}
