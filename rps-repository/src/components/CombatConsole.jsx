import React, { useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleHelp,
  Cpu,
  Crosshair,
  Flame,
  Heart,
  RotateCcw,
  Shield,
  Swords,
  Target,
  Zap,
} from "lucide-react";
import {
  WEAPONS,
  STANCES,
  weaponFor,
  scanSignal,
  repairFrame,
} from "../game/engine";
import { playTone } from "../game/audio";
import WeaponIcon from "./WeaponIcon";
import CalculusLab from "./CalculusLab";
export default function CombatConsole({
  run,
  setRun,
  weapon,
  setWeapon,
  stance,
  setStance,
  busy,
  modal,
  sound,
  engage,
  notify,
  onGuide,
}) {
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const district = run.enemy.district,
    intent = run.scanned ? weaponFor(run.scanned) : WEAPONS[run.enemy.signal],
    selected = weaponFor(weapon),
    overdriveLocked = run.charge < 40 || run.heat >= 75;
  return (
    <section
      className={`combat-console ${tacticsOpen ? "tactics-open" : ""}`}
      aria-label="Combat controls"
    >
      <div className="signal-strip">
        <div className="signal-main">
          <span className="signal-icon">
            <Activity size={17} />
          </span>
          <span className="signal-name">Enemy signal</span>
          <WeaponIcon type={intent.id} size={25} />
          <strong>{intent.name}</strong>
          <span className="signal-likelihood">
            {run.scanned
              ? "100% confirmed"
              : `${run.enemy.confidence}% likelihood`}
          </span>
        </div>
        <div className="signal-tip">
          {district.reverse ? (
            <>
              <RotateCcw size={13} />
              Counter cycle reversed
            </>
          ) : (
            <>
              <CircleHelp size={13} />A signal, not a promise
            </>
          )}
        </div>
        <button className="text-button" onClick={() => onGuide()}>
          Learn the cycle <ArrowUpRight size={13} />
        </button>
      </div>
      {run.enemy.ability && (
        <div className="apex-warning">
          <Target size={14} />
          <b>{run.enemy.ability.name}</b>
          <span>{run.enemy.ability.detail}</span>
        </div>
      )}
      <div className="loadout-row">
        <div className="weapon-loadout">
          {WEAPONS.map((w, index) => {
            const beats = district.reverse
              ? WEAPONS.find((other) => other.beats === w.id)
              : weaponFor(w.beats);
            return (
              <button
                key={w.id}
                style={{ "--weapon-color": w.color }}
                className={`weapon-card ${weapon === w.id ? "selected" : ""}`}
                aria-pressed={weapon === w.id}
                disabled={busy || run.phase !== "ready"}
                onClick={() => {
                  setWeapon(w.id);
                  playTone("select", sound);
                }}
              >
                <span className="weapon-key">0{index + 1}</span>
                <span className="weapon-art">
                  <WeaponIcon type={w.id} />
                </span>
                <div className="weapon-info">
                  <span className="weapon-type">{w.type}</span>
                  <h3>{w.name}</h3>
                  <span className="weapon-matchup">
                    Counters {beats.name.toLowerCase()}
                  </span>
                </div>
                <span className="selection-indicator">
                  {weapon === w.id && <Check size={12} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="engage-block">
          <button
            className="engage-button"
            disabled={busy || run.phase !== "ready" || modal !== null}
            onClick={engage}
          >
            <span>
              {busy
                ? "Engaging"
                : stance === "overdrive"
                  ? "Release overdrive"
                  : "Engage"}
              <small>
                {busy ? "Resolving exchange" : `${selected.name} ${stance}`}
              </small>
            </span>
            {busy ? <Activity size={23} /> : <ArrowRight size={24} />}
          </button>
          <span className="key-hint">
            <kbd>Space</kbd> to engage<span>·</span>
            <kbd>1</kbd>
            <kbd>2</kbd>
            <kbd>3</kbd> to switch
          </span>
        </div>
      </div>
      <button
        className="mobile-tactics-toggle"
        aria-expanded={tacticsOpen}
        aria-controls="frame-tactics"
        onClick={() => setTacticsOpen(!tacticsOpen)}
      >
        <span>
          <Cpu size={15} /> Tactics{" "}
          <small>
            {stance === "strike"
              ? "Optional"
              : stance === "guard"
                ? "Guard active"
                : "Overdrive armed"}
          </small>
        </span>
        <ChevronDown size={16} />
      </button>
      <div className="utility-row" id="frame-tactics">
        <span className="utility-label">
          <Cpu size={13} />
          Frame utilities
        </span>
        <button
          disabled={
            busy ||
            run.phase !== "ready" ||
            run.charge < 30 ||
            Boolean(run.scanned) ||
            run.scanUsed
          }
          onClick={() => {
            setRun((current) => scanSignal(current));
            playTone("select", sound);
          }}
          title="Spend 30 charge to reveal the exact next enemy weapon. Once per floor."
        >
          <Crosshair size={13} />
          {run.scanned
            ? "Signal confirmed"
            : run.scanUsed
              ? "Scan spent"
              : "Deep scan"}
          <small>
            30 <Zap size={10} />
          </small>
        </button>
        <button
          disabled={
            busy ||
            run.phase !== "ready" ||
            run.credits < 80 ||
            run.hp >= run.maxHp ||
            run.repairUsed
          }
          onClick={() => {
            setRun((current) => repairFrame(current));
            playTone("upgrade", sound);
            notify(
              `Field repair complete. +${Math.min(30, run.maxHp - run.hp)} integrity.`,
            );
          }}
          title={`Recover ${Math.min(30, run.maxHp - run.hp)} integrity for 80 credits. Once per floor.`}
        >
          <Heart size={13} />
          {run.repairUsed ? "Repair used" : "Field repair"}
          <small>80 cr</small>
        </button>
        <span className="utility-note">
          Information or firepower. Choose what matters.
        </span>
      </div>
      <div className="systems-row">
        <div className="stance-control" aria-label="Combat stance">
          <span>Protocol</span>
          {STANCES.map((s) => (
            <button
              key={s.id}
              aria-pressed={stance === s.id}
              title={s.hint}
              disabled={
                busy ||
                run.phase !== "ready" ||
                (s.id === "overdrive" && overdriveLocked)
              }
              className={stance === s.id ? "active" : ""}
              onClick={() => setStance(s.id)}
            >
              {s.id === "strike" ? (
                <Swords size={13} />
              ) : s.id === "guard" ? (
                <Shield size={13} />
              ) : (
                <Zap size={13} />
              )}{" "}
              {s.name}
              {s.id === "overdrive" && <small>40</small>}
            </button>
          ))}
        </div>
        {tacticsOpen && (
          <p className="mobile-stance-hint">
            {STANCES.find((s) => s.id === stance).hint}
          </p>
        )}
        <div className="system-meter charge-meter">
          <Zap size={14} />
          <span>Charge</span>
          <div>
            <i style={{ width: `${run.charge}%` }} />
          </div>
          <b>
            {run.charge}
            <span>%</span>
          </b>
        </div>
        <div
          className={`system-meter heat-meter ${run.heat >= 75 ? "overheated" : ""}`}
        >
          <Flame size={14} />
          <span>{run.heat >= 75 ? "Overheated" : "Heat"}</span>
          <div>
            <i style={{ width: `${run.heat}%` }} />
          </div>
          <b>
            {run.heat}
            <span>%</span>
          </b>
        </div>
      </div>
      <CalculusLab run={run} stance={stance} />
    </section>
  );
}
