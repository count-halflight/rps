import test from "node:test";
import assert from "node:assert/strict";
test("battle audio schedules a music cut before the final impact and cleans up its audio graph", async () => {
  const events = [],
    nodes = [];
  class Param {
    value = 0;
    setValueAtTime(value, time) {
      events.push({ method: "set", value, time });
    }
    linearRampToValueAtTime(value, time) {
      events.push({ method: "ramp", value, time });
    }
    exponentialRampToValueAtTime(value, time) {
      events.push({ method: "exponential", value, time });
    }
    setTargetAtTime(value, time) {
      events.push({ method: "target", value, time });
    }
    cancelScheduledValues(time) {
      events.push({ method: "cancel", time });
    }
  }
  const node = () => {
    const value = {
      gain: new Param(),
      frequency: new Param(),
      Q: new Param(),
      connect() {},
      disconnect() {
        this.disconnected = true;
      },
    };
    nodes.push(value);
    return value;
  };
  class Context {
    currentTime = 0;
    state = "running";
    destination = {};
    resume() {
      return Promise.resolve();
    }
    createGain() {
      return node();
    }
    createBiquadFilter() {
      return node();
    }
    createOscillator() {
      return { ...node(), start() {}, stop() {} };
    }
  }
  globalThis.window = { AudioContext: Context };
  const audio = await import("../src/game/audio.js");
  try {
    audio.playTone("select", true);
    audio.setAmbience(true);
    audio.setBattleAudio(0.1, 0.1, { id: "test-finish", duration: 5400, impactAt: 0.64 });
    const silence = events.filter(
      (e) => e.value === 0.0001 && ["set", "ramp"].includes(e.method),
    );
    assert.ok(
      silence.some((e) => Math.abs(e.time - (5.4 * 0.64 - 0.5)) < 1e-9),
    );
    assert.ok(silence.some((e) => Math.abs(e.time - 5.4 * 0.64) < 1e-9));
    assert.ok(events.some((e) => e.method === "target" && e.value < 300));
  } finally {
    audio.setAmbience(false);
    delete globalThis.window;
  }
  assert.ok(nodes.some((n) => n.disconnected));
});
