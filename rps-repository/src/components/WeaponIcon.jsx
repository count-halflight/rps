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
          <path d="M16 47V29c0-4 5-5 8-3V16c0-5 8-5 8 0v-2c0-5 8-5 8 0v3c0-5 8-5 8 0v5c0-4 8-4 8 0v16c0 10-9 13-9 17H23c0-5-7-5-7-8Z" />
          <path d="M24 27v11l-7-8m15-13v14m8-14v14m8-9v10M24 48h21" />
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
