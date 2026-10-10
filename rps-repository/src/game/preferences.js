export const FRAME_FINISHES = [
  {
    id: "echo",
    name: "Found signal",
    color: "#6de7cb",
    shell: "#34474a",
    floor: 0,
  },
  {
    id: "ember",
    name: "Furnace-born",
    color: "#ffb076",
    shell: "#493b32",
    floor: 3,
  },
  {
    id: "prism",
    name: "Prism ghost",
    color: "#c0a0ff",
    shell: "#353149",
    floor: 5,
  },
  {
    id: "gilt",
    name: "Gilt circuitry",
    color: "#f4d68c",
    shell: "#454233",
    floor: 10,
  },
  {
    id: "tide",
    name: "Tidewalker",
    color: "#8dceff",
    shell: "#2d3d4e",
    floor: 15,
  },
  {
    id: "moon",
    name: "Moon ceramic",
    color: "#e0f1e7",
    shell: "#727d81",
    floor: 20,
  },
  {
    id: "phantom",
    name: "Market phantom",
    color: "#efa9d4",
    shell: "#443342",
    floor: 30,
  },
];
export const DEFAULT_PREFERENCES = {
  volume: 60,
  music: true,
  quality: "auto",
  motion: "system",
  skin: "echo",
  liveDossiers: true,
};
export function loadPreferences(storage) {
  try {
    const value = JSON.parse(storage.getItem("trinity-preferences-v1"));
    if (!value || typeof value !== "object") return { ...DEFAULT_PREFERENCES };
    return {
      volume: Number.isFinite(value.volume)
        ? Math.max(0, Math.min(100, value.volume))
        : 60,
      music: typeof value.music === "boolean" ? value.music : true,
      quality: ["auto", "high", "low"].includes(value.quality)
        ? value.quality
        : "auto",
      motion: ["system", "reduced"].includes(value.motion)
        ? value.motion
        : "system",
      skin: FRAME_FINISHES.some((f) => f.id === value.skin)
        ? value.skin
        : "echo",
      liveDossiers:
        typeof value.liveDossiers === "boolean" ? value.liveDossiers : true,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}
export function finishUnlocked(finish, bestFloor) {
  return finish.floor === 0 || bestFloor > finish.floor;
}
