import { useEffect, useState } from "react";
import { localDossier } from "./dossiers";
const memory = new Map();
export default function useEncounter(seed, level, enabled = true) {
  const key = `${seed}:${level}`;
  const [encounter, setEncounter] = useState({
    key,
    dossier: localDossier(seed, level),
    ai: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    const initial = memory.get(key) || {
      key,
      dossier: localDossier(seed, level),
      ai: false,
    };
    setEncounter(initial);
    if (!enabled || import.meta.env.VITE_STATIC_HOST === "true") {
      setEncounter({ key, dossier: localDossier(seed, level), ai: false });
      return () => controller.abort();
    }
    if (memory.has(key)) return () => controller.abort();
    fetch("/api/encounter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed, level }),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        if (
          !value?.dossier ||
          typeof value.dossier.name !== "string" ||
          typeof value.dossier.story !== "string" ||
          typeof value.dossier.taunt !== "string"
        )
          return;
        const next = { key, dossier: value.dossier, ai: Boolean(value.ai) };
        memory.set(key, next);
        if (memory.size > 100) memory.delete(memory.keys().next().value);
        if (!controller.signal.aborted) setEncounter(next);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [seed, level, enabled]);
  return encounter.key === key
    ? encounter
    : { key, dossier: localDossier(seed, level), ai: false };
}
