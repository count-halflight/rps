import React from "react";
export default function WeaponIcon({ type, size = 52 }) {
  const id = `metal-${type}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={id}
          x1="12"
          y1="10"
          x2="48"
          y2="55"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#dbe5e2" />
          <stop offset=".4" stopColor="#6a7e7b" />
          <stop offset="1" stopColor="#233a37" />
        </linearGradient>
      </defs>
      {type === "rock" && (
        <>
          <path
            d="m13 26 8-12 22-1 10 14-5 22-18 7-17-12Z"
            fill={`url(#${id})`}
            stroke="#96aca6"
          />
          <path
            d="m13 26 17 6 23-5M30 32v24M21 14l9 18 13-19M13 44l17-12 18 17"
            stroke="#192a26"
            strokeWidth="2"
          />
          <path
            d="m20 26 10 4 13-3M30 36v12"
            stroke="#75f2cd"
            strokeWidth="2"
          />
        </>
      )}
      {type === "paper" && (
        <>
          <path
            d="m32 7 22 13v26L32 58 10 46V20Z"
            fill={`url(#${id})`}
            fillOpacity=".35"
            stroke="#aeb7fa"
          />
          <path
            d="m32 13 17 10v20L32 53 15 43V23Z"
            stroke="#b4bdfa"
            strokeWidth="2"
          />
          <path
            d="m32 22 9 5v10l-9 5-9-5V27Z"
            fill="#707fa9"
            stroke="#ced5ff"
          />
          <path
            d="M32 8v13m0 22v14M11 20l11 6m20 11 11 8M11 46l11-8m20-12 11-6"
            stroke="#aeb7fa"
          />
        </>
      )}
      {type === "scissors" && (
        <>
          <path
            d="m42 6-2 24-18 19-5-5 16-23Z"
            fill={`url(#${id})`}
            stroke="#c9b698"
          />
          <path
            d="m21 6 3 24 18 19 5-5-17-23Z"
            fill={`url(#${id})`}
            stroke="#c9b698"
          />
          <path
            d="m38 11-7 16-11 14m6-30 7 16 11 14"
            stroke="#ffc580"
            strokeWidth="2"
          />
          <circle cx="17" cy="48" r="7" stroke="#8b918d" strokeWidth="4" />
          <circle cx="46" cy="48" r="7" stroke="#8b918d" strokeWidth="4" />
          <circle cx="32" cy="32" r="3" fill="#d9d4be" />
        </>
      )}
    </svg>
  );
}
