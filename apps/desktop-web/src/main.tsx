import { createRoot } from "react-dom/client";
import { DesktopBrowserApp } from "./app/DesktopBrowserApp.tsx";
import "./guardian.css";
import {
  composePairedDesktopCommands,
  type DesktopCommandSender,
} from "./app/PairedDesktopCommands.ts";

declare global {
  interface Window {
    __KAIRO_TEST_COMMAND_SENDER__?: DesktopCommandSender;
  }
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("desktop_root_not_found");
}

createRoot(root).render(
  <DesktopBrowserApp
    commandSender={
      window.__KAIRO_TEST_COMMAND_SENDER__ ?? composePairedDesktopCommands()
    }
  />,
);
