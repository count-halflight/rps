import React from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Modal, IconFor } from "./ui";
import { WEAPONS, UPGRADES, rewardChoices, floorSupply } from "../game/engine";
import { FRAME_FINISHES, finishUnlocked } from "../game/preferences";
import WeaponIcon from "./WeaponIcon";
import { dailyDate, dailySeed, dailyLabel } from "../game/daily";
export default function GameDialogs({
  modal,
  setModal,
  run,
  record,
  dossier,
  busy,
  advance,
  restart,
  preferences,
  setPreferences,
  onTraining,
  onFullscreen,
  isFullscreen,
  training,
}) {
  const today = dailyDate(),
    supply = floorSupply(run),
    supplyFull = (run.inventory?.[supply.id] || 0) >= 5;
  return (
    <>
      {modal === "pause" && (
        <Modal
          title="Paused"
          eyebrow={`Floor ${run.level} · ${run.credits} credits`}
          onClose={() => setModal(null)}
          className="small-modal"
        >
          <div className="menu-options">
            <button onClick={() => setModal(null)}>
              Resume<span>Esc</span>
            </button>
            <button onClick={() => onFullscreen()}>
              {isFullscreen ? "Leave fullscreen" : "Fullscreen"}
              <span>F</span>
            </button>
            <button onClick={() => setModal("settings")}>Settings</button>
            <button onClick={() => setModal("guide")}>How to fight</button>
            <button onClick={() => setModal("archive")}>Your record</button>
            <button onClick={() => setModal("dossier")}>Rival</button>
            <button onClick={onTraining} disabled={busy}>
              Training<span>Optional</span>
            </button>
            <button onClick={() => setModal("restart")} disabled={training}>
              New run
            </button>
          </div>
          <div className="menu-record">
            <span>Best floor {record.level}</span>
            <span>{record.combo} hit best streak</span>
          </div>
        </Modal>
      )}
      {modal === "guide" && (
        <Modal
          title="Win the opening"
          eyebrow="Rock · paper · scissors"
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            Tap a hand. If you win, choose one of your fighter’s attacks or use
            an item. If you lose, the rival attacks. A draw starts the next
            hand. The rival’s tell can be wrong.
          </p>
          <div className="cycle-guide">
            {WEAPONS.map((w) => (
              <div key={w.id}>
                <WeaponIcon type={w.id} size={48} />
                <h3>{w.type}</h3>
                <p>{w.description}</p>
              </div>
            ))}
          </div>
          <ol className="rule-list">
            <li>
              Quick attacks build 14 charge. Safe attacks deal less damage and
              build 22 charge.
            </li>
            <li>
              Heavy attacks cost 40 charge for double damage. They lock at 75
              heat.
            </li>
            <li>
              Items spend your winning action. Medkits heal, coolant clears
              heat, batteries restore charge.
            </li>
            <li>
              Read hand costs 30 charge and works once per floor. Brace halves
              incoming damage when you lose.
            </li>
            <li>
              Win a fight to choose a perk, upgrade or supply, then pick your route. Every
              fifth floor has a boss. The prism vault reverses the cycle.
            </li>
            <li>
              Hit timed prompts to gain 3 charge each and strengthen your attack’s
              follow-up. Tap the target, or press 1, 2 or 3. You can turn prompts
              off in Settings. Reduced motion skips them.
            </li>
          </ol>
          <button
            className="primary-button"
            onClick={onTraining}
            disabled={busy}
          >
            Play the tutorial <ArrowRight size={18} />
          </button>
          <p className="modal-keyboard">
            1 / 2 / 3 choose a hand · Space reveals · 1 / 2 / 3 choose an attack
            · Esc pauses
          </p>
        </Modal>
      )}
      {modal === "dossier" && (
        <Modal
          title={dossier.name}
          eyebrow={dossier.title}
          onClose={() => setModal(null)}
        >
          <blockquote>{dossier.taunt}</blockquote>
          <p className="modal-intro">{dossier.story}</p>
          <div className="daily-circuit">
            <h3>{run.enemy.ability?.name || run.enemy.pattern}</h3>
            <p>
              {run.enemy.ability?.detail ||
                "Watch how the tell changes after each hand. A repeated choice can become predictable."}
            </p>
            <small>{run.enemy.district.detail}</small>
          </div>
        </Modal>
      )}
      {modal === "archive" && (
        <Modal
          title="Your record"
          eyebrow="Saved on this device"
          onClose={() => setModal(null)}
        >
          <div className="archive-records">
            <div>
              <b>{record.level}</b>
              <span>Best floor</span>
            </div>
            <div>
              <b>{record.combo}</b>
              <span>Best hit streak</span>
            </div>
            <div>
              <b>{record.credits}</b>
              <span>Best credits</span>
            </div>
          </div>
          <div className="daily-circuit">
            <h3>Daily run</h3>
            <p>{dailyLabel(today)} · Everyone gets the same rivals.</p>
            <small>
              {record.dailyDate === today
                ? `Your best today: floor ${record.dailyLevel}`
                : "A new seed each day."}
            </small>
            <button
              className="secondary-button"
              onClick={() => setModal("daily")}
              disabled={training || busy}
            >
              Enter daily run <ArrowRight size={17} />
            </button>
          </div>
          <h3 style={{ marginTop: 24, fontSize: 26 }}>Weapon colours</h3>
          <div className="frame-finishes">
            {FRAME_FINISHES.map((f) => (
              <button
                key={f.id}
                disabled={!finishUnlocked(f, record.level)}
                aria-pressed={preferences.skin === f.id}
                className={preferences.skin === f.id ? "selected" : ""}
                onClick={() => setPreferences((p) => ({ ...p, skin: f.id }))}
              >
                <span
                  className="finish-color"
                  style={{ "--finish-color": f.color }}
                />
                <b>{f.name}</b>
                <small>
                  {finishUnlocked(f, record.level)
                    ? preferences.skin === f.id
                      ? "Equipped"
                      : "Unlocked"
                    : `Clear floor ${f.floor}`}
                </small>
              </button>
            ))}
          </div>
          <h3 style={{ fontSize: 26 }}>Upgrades</h3>
          <div className="augment-list">
            {UPGRADES.map((u) => (
              <div key={u.id}>
                <IconFor id={u.icon} />
                <div>
                  <b>{u.name}</b>
                  <small>{u.detail}</small>
                </div>
                <strong>×{run.upgrades[u.id]}</strong>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {(modal === "restart" || modal === "daily") && (
        <Modal
          title={modal === "daily" ? "Daily run" : "Start fresh?"}
          eyebrow={modal === "daily" ? dailyLabel(today) : "Your records stay"}
          onClose={() => setModal("pause")}
          className="small-modal"
        >
          <p className="modal-intro">
            This replaces the current run. Your personal best and unlocked
            signatures stay saved.
          </p>
          <button
            className="primary-button"
            onClick={() =>
              modal === "daily" ? restart(dailySeed(today), today) : restart()
            }
          >
            Start {modal === "daily" ? "daily run" : "new run"}{" "}
            <ArrowRight size={17} />
          </button>
          <button className="secondary-button" onClick={() => setModal(null)}>
            Keep this run
          </button>
        </Modal>
      )}
      {!modal && !busy && run.phase === "upgrade" && (
        <Modal
          title="Victory"
          eyebrow={`Floor ${run.level} cleared`}
          className="upgrade-modal"
        >
          <div className="victory-summary">
            +{run.result?.bounty || 0} credits · Choose your next upgrade
          </div>
          <p className="modal-intro">
            Health fully restored for the next fight.
          </p>
          <div className="upgrade-grid">
            {rewardChoices(run).map((u) => (
              <button key={u.id} onClick={() => advance(u.id)}>
                <span className="upgrade-icon">
                  <IconFor id={u.icon} size={30} />
                </span>
                <h3>{u.name}</h3>
                <p>{u.detail}</p>
                <span className="install-label">
                  Take reward <ArrowRight size={16} />
                </span>
              </button>
            ))}
          </div>
          <div className="next-floor-label">
            {supplyFull ? `${supply.name} stock full` : `+1 ${supply.name.toLowerCase()}`} · Next: floor{" "}
            {run.level + 1} · New rival
          </div>
        </Modal>
      )}
      {!modal && !busy && run.phase === "defeat" && (
        <Modal
          title="You fell"
          eyebrow={`Floor ${run.level}`}
          className="small-modal"
        >
          <div className="archive-records">
            <div>
              <b>{run.level}</b>
              <span>Floor</span>
            </div>
            <div>
              <b>{run.bestCombo}</b>
              <span>Hit streak</span>
            </div>
            <div>
              <b>{run.credits}</b>
              <span>Credits</span>
            </div>
          </div>
          <button className="primary-button" onClick={() => restart()}>
            Fight again <RotateCcw size={18} />
          </button>
          <button
            className="secondary-button"
            onClick={() => setModal("archive")}
          >
            Your record
          </button>
        </Modal>
      )}
    </>
  );
}
