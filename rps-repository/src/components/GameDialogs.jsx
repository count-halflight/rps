import React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Coins,
  Cpu,
  Flame,
  Layers3,
  Play,
  RotateCcw,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { Modal, IconFor, pad } from "./ui";
import { WEAPONS, UPGRADES, upgradeChoices } from "../game/engine";
import { FRAME_FINISHES, finishUnlocked } from "../game/preferences";
import WeaponIcon from "./WeaponIcon";
import { dailyDate, dailySeed, dailyLabel } from "../game/daily";
export default function GameDialogs({
  modal,
  setModal,
  run,
  record,
  dossier,
  ai,
  busy,
  advance,
  restart,
  preferences,
  setPreferences,
  onTraining,
  training,
}) {
  const district = run.enemy.district;
  const today = dailyDate();
  return (
    <>
      {" "}
      {modal === "dossier" && (
        <Modal
          title={dossier.name}
          eyebrow="Intercepted transmission"
          onClose={() => setModal(null)}
          className="dossier-modal"
        >
          <div className="dossier-profile">
            <span>
              <Target size={38} />
            </span>
            <div>
              <h3>{dossier.title}</h3>
              <p>
                {run.enemy.serial} · {run.enemy.pattern} protocol
              </p>
            </div>
            <span className="dossier-source">
              {ai ? "Live signal" : "Recovered signal"}
            </span>
          </div>
          <blockquote>“{dossier.taunt}”</blockquote>
          <p className="modal-intro">{dossier.story}</p>
          <div className="dossier-attributes">
            <div>
              <span>District</span>
              <b>{district.name}</b>
            </div>
            <div>
              <span>Threat class</span>
              <b>{run.enemy.boss ? "Apex" : "Combat frame"}</b>
            </div>
            <div>
              <span>Protocol</span>
              <b>{run.enemy.pattern}</b>
            </div>
          </div>
          <div className="protocol-intel">
            <Activity size={20} />
            <p>
              {run.enemy.ability?.id === "mirror"
                ? "This frame rewrites its next signal to counter your previous weapon. Read the new forecast instead of repeating your last choice."
                : run.enemy.pattern === "adaptive"
                  ? "This frame learns your last weapon and often prepares its counter. Watch how its signal changes after each exchange."
                  : run.enemy.pattern === "methodical"
                    ? "This frame cycles its forecast in a fixed order. The forecast is unusually reliable outside static zones."
                    : "This frame favors a signature weapon. Its aggression is predictable, but occasional deviations can catch you."}
            </p>
          </div>
          {run.enemy.ability && (
            <div className="apex-intel">
              <Target size={22} />
              <div>
                <h3>{run.enemy.ability.name}</h3>
                <p>{run.enemy.ability.detail}</p>
              </div>
            </div>
          )}
          <button className="primary-button" onClick={() => setModal(null)}>
            Return to the arena <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {modal === "guide" && (
        <Modal
          title="Three instincts. One counter."
          eyebrow="The field guide"
          onClose={() => setModal(null)}
          className="guide-modal"
        >
          <p className="modal-intro">
            A duel of prediction, not reflexes. Choose your weapon, set a
            protocol, then commit. The hostile frame chooses at the same time.
          </p>
          <button
            className="secondary-button guide-training-button"
            onClick={onTraining}
            disabled={busy}
          >
            <Target size={17} />{" "}
            {training
              ? "Restart training"
              : "Play the optional training circuit"}{" "}
            <ArrowRight size={17} />
          </button>
          <div className="cycle-guide">
            {WEAPONS.map((w) => (
              <div key={w.id}>
                <WeaponIcon type={w.id} size={58} />
                <h3>{w.name}</h3>
                <span>{w.type}</span>
                <p>{w.description}</p>
                <ChevronRight size={17} />
              </div>
            ))}
          </div>
          <div className="guide-sections">
            <div>
              <Activity size={21} />
              <h3>Read between the signals</h3>
              <p>
                Passive scans show the probability of the next enemy weapon.
                Deep scan reveals the exact next attack. Methodical forecasts
                follow a cycle. Static districts distort passive scans.
              </p>
            </div>
            <div>
              <Zap size={21} />
              <h3>Build your advantage</h3>
              <p>
                Strike earns 14 charge. Guard earns 22 and halves incoming
                damage. Spend 40 on overdrive for double damage. At 75 heat,
                damage drops and overdrive locks.
              </p>
            </div>
            <div>
              <Cpu size={21} />
              <h3>Become something else</h3>
              <p>
                Clear a floor to choose an augment and recover integrity. Every
                fifth floor is an apex encounter. Districts change the rules,
                including reversing the counter cycle. Each apex carries its own
                ability. Read its dossier before committing.
              </p>
            </div>
            <div>
              <Trophy size={21} />
              <h3>Make the descent yours</h3>
              <p>
                Chain counters for bonus damage. Earn credits and set a personal
                best. Spend 30 charge on a deep scan once per floor to reveal
                the next attack, or 80 credits on a field repair once per floor.
                Runs have no final floor. Your current run and records save
                automatically on this device.
              </p>
            </div>
          </div>
          <button className="primary-button" onClick={() => setModal(null)}>
            I’m ready <ArrowRight size={17} />
          </button>
          <p className="modal-keyboard">
            1 / 2 / 3 select a weapon · Space commits · Escape pauses
          </p>
        </Modal>
      )}
      {modal === "archive" && (
        <Modal
          title="A record of your descent."
          eyebrow="Your archive"
          onClose={() => setModal(null)}
        >
          <div className="archive-records">
            <div>
              <Trophy size={22} />
              <b>{pad(record.level)}</b>
              <span>Deepest floor</span>
            </div>
            <div>
              <Coins size={22} />
              <b>{record.credits}</b>
              <span>Best run credits</span>
            </div>
            <div>
              <Flame size={22} />
              <b>{record.combo}x</b>
              <span>Longest chain</span>
            </div>
          </div>
          <div className="daily-circuit">
            <span className="daily-symbol">
              <Target size={25} />
            </span>
            <div>
              <h3>
                The daily circuit <span>{dailyLabel(today)}</span>
              </h3>
              <p>Same hostile frames. Same salvage. Your own decisions.</p>
              <small>
                {record.dailyDate === today
                  ? `Your best today: floor ${pad(record.dailyLevel)}`
                  : "A fresh circuit every day, shared by every pilot."}
              </small>
            </div>
            <button
              className="secondary-button"
              disabled={busy || training}
              onClick={() => setModal("daily")}
            >
              Enter <ArrowRight size={15} />
            </button>
          </div>
          <div className="finishes-title">
            <h3>Frame signatures</h3>
            <span>Earned in the circuit</span>
          </div>

          <div className="frame-finishes">
            {FRAME_FINISHES.map((f) => {
              const unlocked = finishUnlocked(f, record.level);
              return (
                <button
                  key={f.id}
                  disabled={!unlocked}
                  aria-pressed={preferences.skin === f.id}
                  title={unlocked ? f.name : `Clear floor ${f.floor} to unlock`}
                  className={preferences.skin === f.id ? "selected" : ""}
                  onClick={() => setPreferences((p) => ({ ...p, skin: f.id }))}
                >
                  <span
                    className="finish-color"
                    style={{ "--finish-color": f.color }}
                  />
                  <b>{f.name}</b>
                  <small>
                    {unlocked
                      ? preferences.skin === f.id
                        ? "Equipped"
                        : "Unlocked"
                      : `Floor ${String(f.floor).padStart(2, "0")}`}
                  </small>
                </button>
              );
            })}
          </div>
          <h3 className="archive-section-title">Current frame / Echo 01</h3>
          <div className="augment-list">
            {UPGRADES.map((u) => (
              <div key={u.id}>
                <span>
                  <IconFor id={u.icon} />
                </span>
                <div>
                  <b>{u.name}</b>
                  <small>{u.detail}</small>
                </div>
                <strong className={run.upgrades[u.id] ? "equipped" : ""}>
                  {run.upgrades[u.id] ? `×${run.upgrades[u.id]}` : "Offline"}
                </strong>
              </div>
            ))}
          </div>
          <div className="archive-bottom">
            <span>Run signature {run.seed.toString(16).toUpperCase()}</span>
            <button
              className="text-button danger-text"
              disabled={busy || training}
              onClick={() => setModal("restart")}
            >
              Start a new run <RotateCcw size={15} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "pause" && (
        <Modal
          title="Take a breath."
          eyebrow="Neural link suspended"
          onClose={() => setModal(null)}
          className="small-modal"
        >
          <p className="modal-intro">The city can wait. Your run is saved.</p>
          <button className="primary-button" onClick={() => setModal(null)}>
            <Play size={17} />
            Resume the descent
          </button>
          <button
            className="secondary-button"
            onClick={() => setModal("guide")}
          >
            Open field guide <BookOpen size={17} />
          </button>
          <button
            className="text-button danger-text"
            onClick={() => setModal("restart")}
          >
            Start a new run <RotateCcw size={15} />
          </button>
        </Modal>
      )}
      {modal === "restart" && (
        <Modal
          title="A new descent?"
          eyebrow="Reset current run"
          onClose={() => setModal("archive")}
          className="small-modal"
        >
          <p className="modal-intro">
            Your current floor, credits, and augments will reset. Your personal
            records stay.
          </p>
          <button className="primary-button" onClick={() => restart()}>
            Start fresh <ArrowRight size={17} />
          </button>
          <button className="secondary-button" onClick={() => setModal(null)}>
            Keep this run
          </button>
        </Modal>
      )}
      {modal === "daily" && (
        <Modal
          title="Today’s descent."
          eyebrow={`Daily circuit / ${dailyLabel(today)}`}
          onClose={() => setModal("archive")}
          className="small-modal"
        >
          <p className="modal-intro">
            Every pilot gets the same encounters and augments today. Your
            current run will reset. Your records and frame signatures stay.
          </p>
          <div className="daily-signature">
            <span>Circuit signature</span>
            <b>{dailySeed(today).toString(16).toUpperCase()}</b>
          </div>
          <button
            className="primary-button"
            onClick={() => restart(dailySeed(today), today)}
          >
            Enter the daily circuit <ArrowRight size={17} />
          </button>
          <button className="secondary-button" onClick={() => setModal(null)}>
            Keep this run
          </button>
        </Modal>
      )}
      {!modal && !busy && run.phase === "upgrade" && (
        <Modal
          title="Leave stronger."
          eyebrow={`Floor ${pad(run.level)} cleared`}
          className="upgrade-modal"
        >
          <div className="victory-summary">
            <span>
              <Check size={17} />
              Hostile frame neutralized
            </span>
            <span>
              <Coins size={17} />+{run.result?.bounty || 0} credits
            </span>
          </div>
          <p className="modal-intro">
            Salvage one augment. Recover 20 integrity, or 35 with a Second
            heart.
          </p>
          <div className="upgrade-grid">
            {upgradeChoices(run).map((u) => (
              <button key={u.id} onClick={() => advance(u.id)}>
                <span className="upgrade-icon">
                  <IconFor id={u.icon} size={29} />
                </span>
                <span className="eyebrow">{u.kind}</span>
                <h3>{u.name}</h3>
                <p>{u.detail}</p>
                <span className="install-label">
                  Install & descend <ArrowRight size={17} />
                </span>
              </button>
            ))}
          </div>
          <div className="next-floor-label">
            <ArrowDownRight size={17} />
            Next floor {pad(run.level + 1)} · New hostile frame · New district
          </div>
        </Modal>
      )}
      {!modal && !busy && run.phase === "defeat" && (
        <Modal
          title="The signal goes quiet."
          eyebrow="Frame integrity lost"
          className="defeat-modal"
        >
          <p className="modal-intro">
            Every descent teaches you something. The city has another story
            waiting.
          </p>
          <div className="archive-records">
            <div>
              <ArrowDownRight size={22} />
              <b>{pad(run.level)}</b>
              <span>Floor reached</span>
            </div>
            <div>
              <Coins size={22} />
              <b>{run.credits}</b>
              <span>Credits earned</span>
            </div>
            <div>
              <Flame size={22} />
              <b>{run.bestCombo}x</b>
              <span>Best chain</span>
            </div>
          </div>
          <button className="primary-button" onClick={() => restart()}>
            Return to the circuit <RotateCcw size={17} />
          </button>
          <button
            className="secondary-button"
            onClick={() => setModal("archive")}
          >
            View your archive <Layers3 size={17} />
          </button>
        </Modal>
      )}
    </>
  );
}
