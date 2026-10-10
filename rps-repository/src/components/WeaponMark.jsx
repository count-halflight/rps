import React from "react";
import WeaponIcon from "./WeaponIcon";
export default function WeaponMark({ style, size = 30 }) {
  if (style === "brawler") return <WeaponIcon type="rock" size={size} />;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {style === "blades" && (
        <>
          <path d="m10 39 22-28 5-3-2 8-20 27m-5-6 7 5m-2-4-5 6M38 39 16 11l-5-3 2 8 20 27m5-6-7 5m2-4 5 6" />
        </>
      )}
      {style === "mage" && (
        <>
          <path d="M24 19v24m0-38 7 8-7 8-7-8Z" />
          <circle cx="24" cy="13" r="11" />
          <path d="M12 28h7m10 0h7" />
        </>
      )}
      {style === "archer" && (
        <>
          <path d="M13 5c25 4 25 34 0 38m0-38 6 19-6 19M7 24h36m-5-5 5 5-5 5m-29-9 4 4-4 4" />
        </>
      )}
      {style === "glaive" && (
        <>
          <path d="m12 44 15-30m-1-8 12-3 1 15-12-4-7-4Z" />
          <path d="m19 18 12 6" />
        </>
      )}
    </svg>
  );
}
