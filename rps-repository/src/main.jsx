import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/chakra-petch/latin-400.css";
import "@fontsource/chakra-petch/latin-500.css";
import "@fontsource/chakra-petch/latin-600.css";
import "@fontsource/chakra-petch/latin-700.css";
import "@fontsource/rajdhani/latin-400.css";
import "@fontsource/rajdhani/latin-500.css";
import "@fontsource/rajdhani/latin-600.css";
import "@fontsource/rajdhani/latin-700.css";
import App from "./App";
import { assetUrl } from "./game/assets";
import "./style.css";
createRoot(document.getElementById("app")).render(<App />);
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register(assetUrl("sw.js"), { scope: import.meta.env.BASE_URL })
      .catch(() => {}),
  );
}
