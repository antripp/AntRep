/**
 * Backend selection.
 *
 * Demo mode (offline, localStorage, seeded accounts) is used when Supabase
 * credentials are missing, when `?demo=1` is in the URL, or after the user
 * presses "Explore the demo". Everything else talks to Supabase.
 */

import { isConfigured } from "../lib/supabase";
import { demoApi, DEMO_ACCOUNTS, resetDemoStore } from "./demoApi";
import { supabaseApi } from "./supabaseApi";
import type { Api } from "./api";

const DEMO_FLAG = "antrep-demo-mode";

function readDemoFlag(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      localStorage.setItem(DEMO_FLAG, "1");
      return true;
    }
    if (params.get("demo") === "0") {
      localStorage.removeItem(DEMO_FLAG);
      return false;
    }
    return localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

/** True when the app is running against the offline demo store. */
export const isDemoMode = !isConfigured || readDemoFlag();

export function enableDemoMode() {
  try {
    localStorage.setItem(DEMO_FLAG, "1");
  } catch {
    /* ignore */
  }
  window.location.href = window.location.pathname;
}

export function disableDemoMode() {
  try {
    localStorage.removeItem(DEMO_FLAG);
  } catch {
    /* ignore */
  }
  window.location.href = window.location.pathname;
}

export const api: Api = isDemoMode ? demoApi : supabaseApi;

export { DEMO_ACCOUNTS, resetDemoStore };
export * from "./types";
