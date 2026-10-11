import React, { useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  Crosshair,
  X,
  Heart,
  Flame,
  Battery,
  ArrowLeft,
  ShoppingBag,
} from "lucide-react";
import {
  WEAPONS,
  STANCES,
  weaponFor,
  damageFor,
  itemAvailable,
  abilityDetail,
} from "../game/engine";
import { perkTotals } from "../game/perks.js";
import { signatureWarning } from "../game/rivals.js";
import { rivalProfile } from "../game/rivalProfile.js";
import { fighterFor, ITEM_TYPES, MOVE_STANCES } from "../game/fighters";
import WeaponIcon from "./WeaponIcon";
import WeaponMark from "./WeaponMark";
import CalculusLab from "./CalculusLab";
export default function CombatConsole({
  run,
  weapon,
  setWeapon,
  stance,
  setStance,
  pending,
  chooseAction,
  busy,
  modal,
  engage,
  onGuide,
  onScan,
}) {
  const bar = useRef(null);
  useEffect(() => {
    const node = bar.current,
      parent = node.closest(".game-surface"),
      sync = () =>
        parent.style.setProperty(
          "--console-height",
          `${node.getBoundingClientRect().height}px`,
        );
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    sync();
    return () => {
      observer.disconnect();
      parent.style.removeProperty("--console-height");
    };
  }, []);
  const [open, setOpen] = useState(false),
    [bag, setBag] = useState(false);
  const intent = run.scanned
      ? weaponFor(run.scanned)
      : WEAPONS[run.enemy.signal],
    disabled = busy || run.phase !== "ready" || !!modal;
  const perks=perkTotals(run),scanCost=Math.max(0,30-(perks.scanDiscount||0));
  const earned = pending?.stage === "action",
    fighter = fighterFor(run.character),
    hand = pending?.playerWeapon || weapon;
  const rival = rivalProfile(run.seed, run.level, run.enemy, run.character);
  return (
    <section
      ref={bar}
      className={`combat-console ${earned ? "action-ready" : ""} ${open ? "tactics-open" : ""}`}
      aria-label="Combat controls"
      style={{ '--fighter-color': fighter.color }}
    >
      {signatureWarning(run)&&<div className="signature-warning" role="status">{rival.name} is readying {rival.signature || run.enemy.rival.signature}. Win the hand to stop it.</div>}
      <div className="combat-read">
        <span>
          {earned
            ? `${weaponFor(hand).type} won. ${bag ? "Use an item" : "Choose an attack"}`
            : busy
              ? "Attack in progress"
              : run.result?.item
                ? "Item used. Choose a hand."
                : run.result?.outcome === "loss"
                  ? "Your turn. Choose a hand."
                  : run.result?.outcome === "draw"
                    ? "Draw. Choose again."
                    : "Tap rock, paper or scissors"}
        </span>
        <div className="enemy-tell" style={{'--tell-confidence': `${Math.min(100,run.enemy.confidence+(perks.tellBoost||0))}%`}}>
          <span title={run.enemy.rival.personalityInfo.detail}>{run.enemy.rival.personalityInfo.name}</span>
          <WeaponIcon type={intent.id} size={20} />
          <b>{intent.type}</b>
          <small>{run.scanned ? "Certain" : `${Math.min(100,run.enemy.confidence+(perks.tellBoost||0))}%`}</small>
        </div>
      </div>
      {run.enemy.district.reverse && !busy && <div className="cycle-warning" role="note">
        <b>Prism rules</b><span>Rock beats paper · Paper beats scissors · Scissors beats rock</span>
      </div>}
      {earned ? (
        <div className="earned-actions">
          {bag ? (
            <div className="item-loadout">
              {ITEM_TYPES.map((item, index) => {
                const Icon = [Heart, Flame, Battery][index];
                return (
                  <button
                    key={item.id}
                    className="item-card"
                    disabled={disabled || !itemAvailable(run, item.id)}
                    onClick={() => {
                      setBag(false);
                      chooseAction(0, item.id);
                    }}
                  >
                    <Icon size={25} />
                    <div>
                      <b>
                        {item.name} <small>×{run.inventory[item.id]}</small>
                      </b>
                      <span>{item.detail}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="attack-loadout">
              {fighter.moves[hand].map((name, index) => {
                const attackStance = MOVE_STANCES[index],
                  locked = index === 2 && (run.charge < 40 || run.heat >= 75);
                return (
                  <button
                    key={name}
                    className={`attack-card attack-${index} ${run.heat >= 75 && index === 2 ? 'too-hot' : ''}`}
                    disabled={disabled || locked}
                    onClick={() => chooseAction(index)}
                  >
                    <small className="attack-kind">
                      {index === 0
                        ? "Strike"
                        : index === 1
                          ? "Guard"
                          : "Overdrive"}
                    </small>
                    <WeaponMark style={fighter.style} size={27} />
                    <b>{name}</b>
                    <span>
                      {damageFor(run, "win", attackStance)} damage ·{" "}
                      {index === 2
                        ? "−40 charge"
                        : index === 1
                          ? "+22 charge"
                          : "+14 charge"}
                    </span>
                    {locked && (
                      <small>
                        {run.heat >= 75 ? "Too hot" : "Not enough charge"}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <button
            className="bag-button"
            onClick={() => setBag(!bag)}
            disabled={disabled}
          >
            {bag ? <ArrowLeft size={21} /> : <ShoppingBag size={21} />}
            <span>{bag ? "Attacks" : "Items"}</span>
          </button>
        </div>
      ) : (
        <div className="loadout-row">
          <div className="weapon-loadout">
            {WEAPONS.map((w, index) => {
              const beats = run.enemy.district.reverse
                ? WEAPONS.find((other) => other.beats === w.id)
                : weaponFor(w.beats);
              return (
                <button
                  key={w.id}
                  className={`weapon-card ${weapon === w.id ? "selected" : ""}`}
                  style={{ "--weapon-color": w.color, "--fighter-color": fighter.color }}
                  aria-pressed={weapon === w.id}
                  disabled={disabled || !!pending}
                  onClick={() => {
                    setOpen(false);
                    setBag(false);
                    setWeapon(w.id);
                    engage(w.id);
                  }}
                >
                  <span className="weapon-key">{index + 1}</span>
                  <WeaponIcon type={w.id} size={39} />
                  <div>
                    <b>{w.type}</b>
                    <small>beats {beats.type.toLowerCase()}</small>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="combat-foot">
        <div className="resource-strip">
          <span className="charge-text" style={{'--charge-fill': `${Math.min(100,run.charge)}%`}}>
            Charge <b>{run.charge}</b>
            <i className="charge-cells" aria-hidden="true" />
          </span>
          <span className={`heat-text ${run.heat >= 75 ? "hot" : ""}`} style={{'--heat-fill': `${Math.min(100,run.heat)}%`}}>
            Heat <b>{run.heat}</b>
            <i className="heat-meter" aria-hidden="true"><em /></i>
          </span>
          <span>{run.credits} cr</span>
        </div>
        <button
          className="mobile-tactics-toggle"
          aria-expanded={open}
          aria-controls="frame-tactics"
          onClick={() => setOpen(!open)}
          disabled={disabled || !!pending}
        >
          Options{open ? <X size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="tactics-drawer" id="frame-tactics">
          <div className="stance-control" aria-label="Defence when losing">
            {STANCES.filter((s) => s.id !== "overdrive").map((s) => (
              <button
                key={s.id}
                aria-pressed={stance === s.id}
                className={stance === s.id ? "active" : ""}
                disabled={disabled || !!pending}
                onClick={() => setStance(s.id)}
              >
                <b>{s.id === "strike" ? "Normal defence" : "Brace"}</b>
                <small>
                  {s.id === "strike"
                    ? "Normal incoming damage"
                    : "Take half damage if you lose"}
                </small>
              </button>
            ))}
          </div>
          <div className="utility-row">
            <button
              disabled={
                disabled || !!pending || run.charge < scanCost || run.scanned || run.scanUsed
              }
              onClick={onScan}
            >
              <Crosshair size={16} />
              {run.scanUsed ? "Scan used" : "Read hand"}
              <small>{scanCost} charge · once per floor</small>
            </button>
            <button disabled={disabled || !!pending} onClick={onGuide}>Rules</button>
          </div>
          {run.enemy.ability && (
            <p className="apex-warning">
              <b>{run.enemy.ability.name}</b> {abilityDetail(run.enemy)}
            </p>
          )}
          <CalculusLab run={run} stance={stance} />
        </div>
      )}
    </section>
  );
}
