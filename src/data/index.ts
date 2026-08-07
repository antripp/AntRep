/**
 * Backend selection.
 *
 * Demo mode is the offline store: localStorage, seeded accounts, no database.
 * It applies when there are no Supabase credentials to talk to, or when the
 * demo is explicitly asked for with `?demo=1` / the "Explore the demo" button.
 *
 * The switch lives in sessionStorage, so it lasts for the tab and no longer.
 * It used to be a localStorage flag, which meant one tap on "Explore the demo"
 * stranded that browser in demo mode permanently — on production too, where it
 * looked like sign-in was broken: real credentials don't exist in the demo
 * store, and signing up quietly created a local dummy account instead.
 */

import { isConfigured } from "../lib/supabase";
import { demoApi, DEMO_ACCOUNTS, resetDemoStore } from "./demoApi";
import { supabaseApi } from "./supabaseApi";
import type { Api } from "./api";

const DEMO_FLAG = "antrep-demo-mode";

function readDemoRequest(): boolean {
  try {
    // Clear the old sticky flag wherever it still exists, so anyone already
    // stranded by it lands back on the real app at their next page load.
    localStorage.removeItem(DEMO_FLAG);

    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") {
      sessionStorage.setItem(DEMO_FLAG, "1");
      return true;
    }
    if (params.get("demo") === "0") {
      sessionStorage.removeItem(DEMO_FLAG);
      return false;
    }
    return sessionStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

/** True when the app is running against the offline demo store. */
export const isDemoMode = !isConfigured || readDemoRequest();

/**
 * A production build with no credentials can't reach a database — it will run
 * on demo data no matter what the user does. That's a broken deploy, not a
 * feature, so the auth screen says so out loud.
 */
export const isMissingBackend = !isConfigured && import.meta.env.PROD;

/**
 * Whether to advertise the demo in the UI. Never in production: a real
 * deployment shouldn't offer seeded accounts on its sign-in page. `?demo=1`
 * still works there for anyone who wants it deliberately.
 */
export const showDemoUi = import.meta.env.DEV;

export function enableDemoMode() {
  try {
    sessionStorage.setItem(DEMO_FLAG, "1");
  } catch {
    /* ignore */
  }
  window.location.href = window.location.pathname;
}

export function disableDemoMode() {
  try {
    sessionStorage.removeItem(DEMO_FLAG);
    localStorage.removeItem(DEMO_FLAG);
  } catch {
    /* ignore */
  }
  window.location.href = window.location.pathname;
}

export const api: Api = isDemoMode ? demoApi : supabaseApi;

export { DEMO_ACCOUNTS, resetDemoStore };
export * from "./types";
