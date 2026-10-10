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
      title="Tune your neural link."
      eyebrow="Frame settings"
      onClose={onClose}
      className="settings-modal"
    >
      <div className="setting-row">
        <div>
          <h3>
            <Volume2 size={16} />
            Sound
          </h3>
          <p>Combat feedback and the city’s pulse.</p>
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
          <h3>Atmosphere</h3>
          <p>Let the district play underneath the fight.</p>
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
          <h3>
            <Radio size={16} />
            Live dossiers
          </h3>
          <p>Receive new rival stories when a live link is available.</p>
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
      <button className="primary-button" onClick={onClose}>
        Back to the circuit <ArrowRight size={17} />
      </button>
    </Modal>
  );
}
