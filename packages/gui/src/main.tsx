import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import {
  applyUiTheme,
  DEFAULT_UI_THEME,
  readStoredUiTheme,
  syncShellFrameMetrics,
} from "./theme";
import "./styles/themes.css";
import "./styles/app.css";

// Prefer cached theme; avoid forcing candy over a stored selection before config loads.
applyUiTheme(readStoredUiTheme() ?? DEFAULT_UI_THEME);
syncShellFrameMetrics();
window.addEventListener("resize", syncShellFrameMetrics);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
