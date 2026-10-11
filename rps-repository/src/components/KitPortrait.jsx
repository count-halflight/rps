import React from 'react';

// Original small bust marks. The arena remains the detailed character view.
const HAIR = {
  echo: 'M19 26L16 14L24 5L36 3L44 13L43 25L38 16L26 19Z',
  cinder: 'M18 23L17 13L23 7L37 7L43 14L42 23L37 16L24 16Z',
  nyx: 'M15 34L16 14Q17 5 31 4Q45 5 46 16L45 35L38 27L37 14L23 14L22 27Z',
  vex: 'M18 25L18 13L25 5L38 6L43 15L44 27L37 16L23 20Z',
  kuro: 'M17 27L16 14L24 7L33 2L43 7L45 16L39 11L24 21L24 30Z',
};
export default function KitPortrait({ character = 'echo', color = '#6de7cb', bossId }) {
  if (bossId) return <svg className="kit-portrait boss-portrait" viewBox="0 0 64 64" aria-hidden="true" style={{ '--portrait-color': color }}>
    <path fill="#101b20" stroke="currentColor" strokeOpacity=".35" d="M3 63L7 46L21 39L20 14L28 5L43 8L49 20L47 40L59 47L62 63Z" />
    <path fill="#4e6167" d="M20 14L29 8L41 11L46 23L43 37L33 44L23 36Z" />
    <path fill="#17272e" d="M23 18L43 19L42 29L25 28Z" />
    <path fill="currentColor" d="M24 22L42 22L40 25L26 25Z" />
    <path fill="#6a7d7d" d="M28 30L37 31L34 39L30 37Z" />
    <path fill="#273c43" d="M8 48L22 40L32 49L43 40L57 48L60 64H4Z" />
    <path fill="none" stroke="currentColor" strokeWidth="2" d="M10 48L21 44M45 44L56 48M32 51V62" />
  </svg>;
  return <svg className={`kit-portrait portrait-${character}`} viewBox="0 0 64 64" aria-hidden="true" style={{ '--portrait-color': color }}>
    {character === 'vex' && <path fill="#1c3035" d="M39 15L52 11L49 29L54 39L46 35L41 23Z" />}
    <path fill="#1c2b31" d="M6 64L9 48L24 40H39L55 48L59 64Z" />
    <path fill="#b99a87" d="M26 32V45L32 50L38 44V32Z" />
    <path fill="#dcc5ae" d="M20 17L28 11L37 12L42 19L40 32L35 40H27L22 32Z" />
    <path fill="#9b7d6d" d="M36 20L41 19L40 31L35 39H31L36 31Z" />
    <path fill={character === 'kuro' ? '#c4cfce' : character === 'cinder' ? '#34312e' : '#18242b'} d={HAIR[character] || HAIR.echo} />
    <path fill="#26353b" d="M23 24L28 23L28 25L24 26ZM34 23L39 24L38 26L34 25Z" />
    <path fill="none" stroke="#835c50" strokeWidth="1.2" d="M29 33L34 33" />
    <path fill="#31464c" d="M23 42L31 51L23 60L14 48ZM39 42L32 51L42 60L51 48Z" />
    <path fill="none" stroke="currentColor" strokeWidth="2" d="M13 50L22 47M42 47L52 51" />
    {character === 'nyx' && <path fill="none" stroke="currentColor" strokeWidth="1.7" d="M18 17L24 13L31 16L38 13L44 18" />}
    {character === 'echo' && <path fill="currentColor" d="M25 12L39 8L41 11L26 15Z" opacity=".65" />}
    {character === 'cinder' && <path fill="none" stroke="#8e6352" strokeWidth="1.6" d="M24 28L27 32M40 27L37 30" />}
  </svg>;
}
