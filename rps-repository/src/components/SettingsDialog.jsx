import React from "react";
import {
  ArrowRight,
  Check,
  Cpu,
  Radio,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { Modal } from "./ui";
import { playTone } from "../game/audio";
export default function SettingsDialog({
  preferences,
  setPreferences,
  sound,
  setSound,
  onClose,
}) {
  const update = (key, value) =>
    setPreferences((p) => ({ ...p, [key]: value }));
  return (
    <Modal
      title="Settings"
      eyebrow="Sound & display"
      onClose={onClose}
      className="settings-modal"
    >
      <div className="setting-row">
        <div>
          <h3>
            <Volume2 size={16} />
            Sound
          </h3>
          <p>Attack sounds and music.</p>
        </div>
        <button
          className={`setting-toggle ${sound ? "on" : ""}`}
          aria-pressed={sound}
          aria-label="Toggle sound"
          onClick={() => {
            setSound(!sound);
            playTone("select", !sound);
          }}
        >
          <span />
        </button>
      </div>
      <div className="setting-row">
        <label htmlFor="volume">
          <h3>Volume</h3>
          <p>{preferences.volume}% output</p>
        </label>
        <input
          id="volume"
          type="range"
          min="0"
          max="100"
          value={preferences.volume}
          onChange={(e) => update("volume", Number(e.target.value))}
        />
      </div>
      <div className="setting-row">
        <div>
          <h3>Music</h3>
          <p>Music changes with both fighters’ health.</p>
        </div>
        <button
          className={`setting-toggle ${preferences.music ? "on" : ""}`}
          aria-pressed={preferences.music}
          aria-label="Toggle ambient music"
          onClick={() => update("music", !preferences.music)}
        >
          <span />
        </button>
      </div>
      <div className="setting-row setting-stacked">
        <div>
          <h3>
            <Cpu size={16} />
            Graphics
          </h3>
          <p>Lower detail uses less battery and GPU power.</p>
        </div>
        <div className="setting-options">
          {[
            ["auto", "Adaptive"],
            ["high", "Full detail"],
            ["low", "Lightweight"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={preferences.quality === id}
              className={preferences.quality === id ? "selected" : ""}
              onClick={() => update("quality", id)}
            >
              {label}
              {preferences.quality === id && <Check size={13} />}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row setting-stacked">
        <div>
          <h3>Motion</h3>
          <p>Reduce camera shake, lunges, and particle movement.</p>
        </div>
        <div className="setting-options">
          {[
            ["system", "Follow device"],
            ["reduced", "Reduced motion"],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={preferences.motion === id}
              className={preferences.motion === id ? "selected" : ""}
              onClick={() => update("motion", id)}
            >
              {label}
              {preferences.motion === id && <Check size={13} />}
            </button>
          ))}
        </div>
      </div>
      <div className="setting-row">
        <div>
          <h3>Cinematic prompts</h3>
          <p>Timed keys or taps add flourishes and earn charge. Off plays the full scene automatically. Reduced motion also skips prompts.</p>
        </div>
        <button className={`setting-toggle ${preferences.cinematicQte ? 'on' : ''}`}
          aria-pressed={preferences.cinematicQte} aria-label="Toggle cinematic prompts"
          onClick={() => update('cinematicQte', !preferences.cinematicQte)}><span /></button>
      </div>
      {import.meta.env.VITE_STATIC_HOST !== "true" && (
        <div className="setting-row">
          <div>
            <h3>
              <Radio size={16} />
              Rival stories
            </h3>
            <p>Optional stories from the online service.</p>
          </div>
          <button
            className={`setting-toggle ${preferences.liveDossiers ? "on" : ""}`}
            aria-pressed={preferences.liveDossiers}
            aria-label="Toggle live dossiers"
            onClick={() => update("liveDossiers", !preferences.liveDossiers)}
          >
            <span />
          </button>
        </div>
      )}{" "}
      <button className="primary-button" onClick={onClose}>
        Done <ArrowRight size={17} />
      </button>
    </Modal>
  );
}
