import React, { Suspense, lazy, useState, useEffect } from "react";
import {
  Activity,
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  Cpu,
  Flame,
  Pause,
  Swords,
  Target,
} from "lucide-react";
import { Meter, pad } from "./ui";
import { weaponFor } from "../game/engine";
import { IntegralGraph } from "./CalculusLab";
import { assetUrl } from "../game/assets";
const Arena = lazy(() => import("./Arena"));
export default function BattleStage({
  run,
  weapon,
  animation,
  busy,
  paused,
  dossier,
  preferences,
  finish,
  onPause,
  onDossier,
}) {
  const [sceneReady, setSceneReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setRevealed(false);
    if (!busy || !animation) return;
    const timer = setTimeout(
      () => setRevealed(true),
      animation.duration * (animation.finisher ? 0.43 : 0.4),
    );
    return () => clearTimeout(timer);
  }, [animation?.id, busy]);
  const district = run.enemy.district,
    result = run.result;
  return (
    <section
      className={`battle-stage ${busy ? "is-attacking" : ""}`}
      aria-label="Combat arena"
    >
      <div
        className="arena-backdrop"
        style={{
          "--arena-image": `url('${assetUrl(`assets/${district.background}.webp`)}')`,
        }}
      />
      <div className="arena-vignette" />
      <div className="arena-topline">
        <span>
          <i className="live-dot" />
          {run.enemy.boss ? "Apex encounter" : "Live encounter"}
          <span className="arena-top-divider">/</span>
          {district.zone}
        </span>
        <div className="level-badge">
          <span>Floor</span>
          <b>{pad(run.level)}</b>
          <ChevronRight size={14} />
        </div>
        <button
          className="arena-pause icon-button"
          onClick={() => !busy && onPause()}
          disabled={busy || run.phase !== "ready"}
          aria-label="Pause game"
        >
          <Pause size={17} />
        </button>
      </div>
      <div className="fighter-hud player-hud">
        <div className="fighter-identity">
          <span className="fighter-avatar">
            <Cpu size={24} />
          </span>
          <div>
            <span className="pilot-label">Your frame</span>
            <h2>
              Echo <span>01</span>
            </h2>
          </div>
          <span className="fighter-class">Vanguard</span>
        </div>
        <Meter value={run.hp} max={run.maxHp} label="Integrity" />
        <div className="fighter-caption">
          <span>
            <i />
            Neural link stable
          </span>
          <span>
            {run.upgrades.armor
              ? `Armor +${run.upgrades.armor * 3}`
              : "Frame online"}
          </span>
        </div>
      </div>
      <div className="fighter-hud opponent-hud">
        <div className="fighter-identity">
          <span className="fighter-class">
            {run.enemy.boss ? "Apex frame" : run.enemy.serial}
          </span>
          <div>
            <span className="pilot-label">Hostile frame</span>
            <button
              className="rival-name"
              onClick={() => onDossier()}
              aria-label="Read rival dossier"
            >
              <h2>{dossier.name}</h2>
              <ArrowUpRight size={11} />
            </button>
          </div>
          <span className="fighter-avatar">
            <Target size={24} />
          </span>
        </div>
        <Meter
          value={run.enemy.hp}
          max={run.enemy.maxHp}
          label="Integrity"
          enemy
        />
        <div className="fighter-caption">
          <span>
            {run.enemy.ability?.id === "mirror"
              ? "Mirrored"
              : run.enemy.pattern}{" "}
            protocol
          </span>
          <span>
            <i />
            Threat detected
          </span>
        </div>
      </div>
      <div className="arena-center-label">
        <span>{run.enemy.boss ? "Apex of the undercity" : "Afterlight"}</span>
        <span className="center-crosshair">+</span>
        <span>{run.enemy.ability?.name || district.name}</span>
      </div>
      <Suspense fallback={null}>
        <Arena
          weapon={weapon}
          quality={preferences.quality}
          reducedMotion={preferences.motion === "reduced"}
          frameFinish={finish}
          phase={run.phase}
          animation={animation}
          district={district}
          paused={paused}
          enemyLevel={run.level}
          onReady={() => setSceneReady(true)}
        />
      </Suspense>
      <div className="frame-label frame-label-left">
        <span className="frame-dot" />
        <span>Echo / neural signature</span>
        <span>01</span>
      </div>
      <div className="frame-label frame-label-right">
        <span>{run.enemy.serial}</span>
        <span>Hostile / unknown origin</span>
        <span className="frame-dot" />
      </div>
      <div className="arena-bottom">
        <div className="environment-chip">
          <span className="weather-symbol">
            {district.modifier === "Rainfall" ? (
              <AudioLines size={20} />
            ) : (
              <Activity size={20} />
            )}
          </span>
          <div>
            <span>{district.modifier}</span>
            <small>{district.detail}</small>
          </div>
        </div>
        <div
          className={`arena-message ${result ? `message-${result.outcome}` : ""}`}
          aria-live="polite"
        >
          {busy ? (
            <>
              <span className="resolving-label">Neural sync in progress</span>
              <strong>Weapons engaged.</strong>
            </>
          ) : result ? (
            <>
              <span className="resolving-label">
                {weaponFor(result.playerWeapon).name}{" "}
                <span className="versus-small">vs</span>{" "}
                {weaponFor(result.enemyWeapon).name}
              </span>
              <strong>
                {result.outcome === "win"
                  ? "Counter confirmed."
                  : result.outcome === "draw"
                    ? "Systems collide."
                    : "Signal misread."}
              </strong>
              <small>
                {result.damage} dealt
                {result.incoming
                  ? ` · ${result.incoming} received`
                  : " · No damage received"}
                {result.healing > 0 ? ` · +${result.healing} restored` : ""}
                {result.enemyHealing > 0
                  ? ` · Hostile repairs +${result.enemyHealing}`
                  : ""}
              </small>
            </>
          ) : (
            <>
              <span className="resolving-label">The city is watching</span>
              <strong>Make your first move.</strong>
              <small>Read the signal. Choose your counter.</small>
            </>
          )}
        </div>
        <div className="turn-counter">
          <span>Exchange</span>
          <b>{String(run.turn + 1).padStart(2, "0")}</b>
          <span className="exchange-icon">
            <Swords size={19} />
          </span>
        </div>
      </div>
      {run.combo >= 2 && (
        <div className="combo-badge">
          <Flame size={18} />
          <span>{run.combo}x</span> Counter chain
        </div>
      )}
      {!sceneReady && (
        <div className="scene-loading">
          <Cpu size={20} />
          Initializing the arena
        </div>
      )}
      {busy && animation && (
        <div
          className={`cinematic-overlay ${animation.finisher ? "is-finisher" : ""} ${animation.reduced ? "cinematic-reduced" : ""}`}
          style={{
            "--attack-color": animation.color,
            "--cinematic-duration": `${animation.duration}ms`,
          }}
          aria-live="polite"
          data-reveal={
            revealed ? (animation.finalHit ? "confirmed" : "denied") : "pending"
          }
        >
          <div className="cinematic-bar cinematic-bar-top" />
          <div className="cinematic-caption">
            <span>
              {animation.finisher
                ? revealed
                  ? "Final attack"
                  : "Final attempt"
                : `${weaponFor(animation.playerWeapon).name} technique`}
            </span>
            <strong>{animation.title}</strong>
            {animation.finisher && (
              <small>
                {!revealed
                  ? "Signal unresolved"
                  : animation.finalHit
                    ? "Hostile link terminated"
                    : animation.outcome === "loss"
                      ? "Counter intercepted. Target still standing."
                      : "Target still standing."}
              </small>
            )}
          </div>
          <div className="cinematic-bar cinematic-bar-bottom" />
          {animation.playerWeapon === "paper" && (
            <div className="cinematic-integral">
              <IntegralGraph
                damage={revealed ? animation.damage : animation.potentialDamage}
                slices={24}
                cinematic={!animation.reduced}
              />
              <span>
                {revealed
                  ? `∫₀¹ f(t)dt = ${animation.damage} impact`
                  : "∫₀¹ f(t)dt · assembling pulse"}
              </span>
            </div>
          )}
          {animation.finisher && <div className="finisher-impact-line" />}
        </div>
      )}
      {busy && animation && revealed && (
        <div
          className={`damage-feedback feedback-${animation.outcome}`}
          aria-hidden="true"
        >
          <span className="damage-enemy">
            −{animation.damage}
            <small>{animation.outcome === "win" ? "Counter" : "Impact"}</small>
          </span>
          {animation.incoming > 0 && (
            <span className="damage-player">
              −{animation.incoming}
              <small>Integrity</small>
            </span>
          )}
        </div>
      )}
    </section>
  );
}
