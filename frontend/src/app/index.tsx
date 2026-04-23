import { createRoot } from "react-dom/client";
import "./index.css";
import "../index.css";
import { App } from "./App";
import { AppProviders } from "./providers";

createRoot(document.getElementById("root")!).render(
  <AppProviders>
    <App />
  </AppProviders>,
);
