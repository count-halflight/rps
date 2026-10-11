import React from 'react';
import WeaponMark from './WeaponMark';
import { fighterFor } from '../game/fighters.js';

const BOSS_WEAPONS = {
  bulwark: <><path d="M6 7h18v23l-9 10-9-10ZM12 16h6m-3-5v18M30 9h12v9H30Zm6 9v25" /></>,
  'crucible-9': <><path d="m11 43 14-31M23 10 43 5 32 18 23 16Z"/><path d="M23 10c-9-8-16 2-8 8"/></>,
  sable: <><path d="M11 42 35 7 31 30ZM9 29l16 11M36 6l5-3M12 37 7 45"/></>,
  redline: <><path d="M7 39 18 6l5 21-12 13ZM41 39 30 6l-5 21 12 13M7 38l8 3M33 41l8-3"/></>,
  cipher: <><path d="M7 40 31 9l8-4-2 10-25 30M14 32l10 8M23 10l-6 8 7 3-9 8M34 22l7-2-7 9 7 3"/></>,
  onyx: <><path d="M14 38 29 9l10-4-1 12-18 27M11 34l15 9M15 38l-7 7M28 12l6 5-9 8"/></>,
};
export default function RivalWeaponMark({ profile, size = 24 }) {
  if (!profile.bossId) return <WeaponMark style={fighterFor(profile.character).style} size={size} />;
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {BOSS_WEAPONS[profile.bossId]}
  </svg>;
}
