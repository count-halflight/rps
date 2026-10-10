import React, { Suspense, lazy, useState, useEffect } from "react";
import { weaponFor } from "../game/engine";
import { ATTACKS } from "../game/cinematics";
import { fighterFor, rivalFighter } from "../game/fighters";
import WeaponIcon from "./WeaponIcon";
import { IntegralGraph } from "./CalculusLab";
const Arena = lazy(() => import("./Arena"));
export default function BattleStage({
  run,
  weapon,
  animation,
  pending,
  busy,
  paused,
  dossier,
  preferences,
  finish,
}) {
  const [ready, setReady] = useState(false),
    [revealed, setRevealed] = useState(false),
    [hands, setHands] = useState(false);
  useEffect(() => {
    setRevealed(false);
    setHands(false);
    if (!busy || !animation) return;
    const one = setTimeout(
        () => setHands(true),
        animation.duration * animation.revealAt,
      ),
      two = setTimeout(
        () => setRevealed(true),
        animation.duration * animation.impactAt,
      );
    return () => {
      clearTimeout(one);
      clearTimeout(two);
    };
  }, [animation?.id, busy]);
  const district = run.enemy.district;
  const attacking =
    animation?.outcome === "loss"
      ? animation?.enemyWeapon
      : animation?.playerWeapon;
  return (
    <section
      className={`battle-stage ${busy && animation ? "is-attacking" : ""}`}
      aria-label="Combat arena"
    >
      <Suspense fallback={null}>
        <Arena
          character={run.character}
          enemyCharacter={
            dossier.name === "Cinder" ? "cinder" : rivalFighter(run.level).id
          }
          weapon={weapon}
          animation={animation}
          district={district}
          paused={paused}
          enemyLevel={run.level}
          quality={preferences.quality}
          reducedMotion={preferences.motion === "reduced"}
          frameFinish={finish}
          phase={run.phase}
          onReady={() => setReady(true)}
        />
      </Suspense>
      <div className="film-shade" />
      <div className="fight-hud">
        <div className="health-side">
          <div className="fighter-name">
            <b>{fighterFor(run.character).name}</b>
            <span>You</span>
          </div>
          <div className="life-bar">
            <i style={{ width: `${(run.hp / run.maxHp) * 100}%` }} />
          </div>
          <small>
            {run.hp} / {run.maxHp}
          </small>
        </div>
        <div className="round-mark">
          <span>{run.enemy.boss ? "Boss" : "Floor"}</span>
          <b>{String(run.level).padStart(2, "0")}</b>
          <small>{run.turn + 1}</small>
        </div>
        <div className="health-side rival">
          <div className="fighter-name">
            <b title={dossier.name}>{dossier.name.split(" ")[0]}</b>
            <span>
              {dossier.name === "Cinder"
                ? "Impact wraps"
                : rivalFighter(run.level).weapon}
            </span>
          </div>
          <div className="life-bar">
            <i
              style={{ width: `${(run.enemy.hp / run.enemy.maxHp) * 100}%` }}
            />
          </div>
          <small>
            {run.enemy.hp} / {run.enemy.maxHp}
          </small>
        </div>
      </div>
      <div className="stage-location">
        <span>{district.zone}</span>
        <b>{district.name}</b>
        <small>
          {district.modifier}
          {district.reverse ? " · reversed cycle" : ""}
        </small>
      </div>
      {run.combo >= 2 && !busy && (
        <div className="streak">
          <b>{run.combo}</b>
          <span>hit streak</span>
        </div>
      )}
      {!ready && <div className="scene-loading">Opening the ring…</div>}
      {pending?.stage === "reveal" && (
        <div
          className={`hand-reveal rps-reveal ${pending.revealed ? "shown" : ""}`}
          aria-label={
            pending.revealed
              ? `${pending.playerWeapon} versus ${pending.enemyWeapon}`
              : "Hands unrevealed"
          }
        >
          <div>
            <WeaponIcon type={pending.playerWeapon} size={60} />
            <span>{weaponFor(pending.playerWeapon).type}</span>
          </div>
          <b>
            {pending.revealed
              ? pending.outcome === "draw"
                ? "="
                : pending.outcome === "win"
                  ? ">"
                  : "<"
              : "?"}
          </b>
          <div>
            {pending.revealed ? (
              <WeaponIcon type={pending.enemyWeapon} size={60} />
            ) : (
              <span className="unknown-hand">?</span>
            )}
            <span>
              {pending.revealed ? weaponFor(pending.enemyWeapon).type : "Ready"}
            </span>
          </div>
          <p>
            {pending.revealed
              ? pending.outcome === "win"
                ? "Your attack"
                : pending.outcome === "loss"
                  ? "Rival attacks"
                  : "Draw"
              : "Rock, paper, scissors"}
          </p>
        </div>
      )}
      {busy && animation && (
        <>
          <div
            className={`cinematic-overlay ${animation.finisher ? "is-finisher" : ""} ${animation.reduced ? "cinematic-reduced" : ""}`}
            style={{
              "--attack-color": animation.color,
              "--cinematic-duration": `${animation.duration}ms`,
            }}
            data-reveal={
              revealed
                ? animation.finalHit
                  ? "confirmed"
                  : "denied"
                : "pending"
            }
          >
            <div className="cinematic-bar cinematic-bar-top" />
            <div className="cinematic-bar cinematic-bar-bottom" />
            <div className="cinematic-caption">
              <span>
                {animation.outcome === "draw"
                  ? "Draw"
                  : animation.outcome === "loss"
                    ? "Rival attacks"
                    : animation.finisher
                      ? "Finish them"
                      : "Your attack"}
              </span>
              <strong>
                {animation.outcome === "draw" ? "Draw" : animation.title}
              </strong>
              {animation.finisher && (
                <small>
                  {!revealed
                    ? "Wait for it…"
                    : animation.finalHit
                      ? "Knockout"
                      : animation.outcome === "loss"
                        ? "Knocked out"
                        : "Still standing"}
                </small>
              )}
            </div>
            {hands &&
              (attacking === "paper" || animation.style === "mage") &&
              animation.outcome !== "draw" && (
                <div className="cinematic-integral">
                  <IntegralGraph
                    damage={
                      revealed
                        ? animation.outcome === "loss"
                          ? animation.incoming
                          : animation.damage
                        : animation.potentialDamage
                    }
                    slices={24}
                    cinematic={!animation.reduced}
                    concealValue={!revealed}
                  />
                  <span>
                    ∫₀¹ f(t)dt{" "}
                    {revealed
                      ? `= ${animation.outcome === "loss" ? animation.incoming : animation.damage}`
                      : ""}
                  </span>
                </div>
              )}
          </div>
          {revealed && (
            <div
              className={`damage-feedback feedback-${animation.outcome}`}
              aria-live="polite"
            >
              {animation.damage > 0 && (
                <span className="damage-enemy">
                  {animation.damage}
                  <small>hit</small>
                </span>
              )}
              {animation.incoming > 0 && (
                <span className="damage-player">
                  {animation.incoming}
                  <small>damage</small>
                </span>
              )}
              {animation.outcome === "draw" && (
                <span className="draw-feedback">Again</span>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
