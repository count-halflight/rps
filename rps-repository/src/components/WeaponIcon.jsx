import React from "react";
export default function WeaponIcon({ type, size = 52 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "rock" && (
        <>
          <path d="M16 47c-4-4-5-8-5-13v-5c0-4 4-6 7-5l3 2v-3c0-6 9-6 9 0v-2c0-6 9-6 9 0v2c0-5 8-5 8 0v3c0-5 8-5 8 0v12c0 8-5 12-9 15v4H21v-4l-5-6Z" />
          <path d="m21 26 14 3c6 1 6 8 0 8l-12-1M30 23v6m9-6v7m8-4v8M21 46h23" />
        </>
      )}
      {type === "paper" && (
        <>
          <path d="M24 34V13c0-5 7-5 7 0v17V9c0-5 7-5 7 0v21V12c0-5 7-5 7 0v20V19c0-5 7-5 7 0v22c0 9-10 10-10 15H24c0-5-5-8-8-13l-6-12c-2-5 4-7 7-3l7 6Z" />
          <path d="M28 46h13" />
        </>
      )}
      {type === "scissors" && (
        <>
          <path d="m23 35-8-21c-2-6 5-9 7-3l10 22 7-24c2-6 9-4 7 2l-6 26c5-5 12-1 9 4l-4 6c-3 4-6 5-6 10H22c0-5-8-8-8-14V32c0-6 8-5 9 3Z" />
          <path d="m23 35 4 8 13-6m-10 7h7" />
        </>
      )}
    </svg>
  );
}
