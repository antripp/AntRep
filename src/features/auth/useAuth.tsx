import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { Profile, Role } from "../../lib/types";

const ACTIVE_ROLE_KEY = "antrep-active-role";

interface AuthState {
  loading: boolean;
  authSession: AuthSession | null;
  /** Profile for the currently active portal role. */
  profile: Profile | null;
  /** All profiles belonging to this auth user (coach and/or athlete). */
  allProfiles: Profile[];
  activeRole: Role;
  isAdmin: boolean;
  setActiveRole: (role: Role) => void;
  refreshProfiles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  authSession: null,
  profile: null,
  allProfiles: [],
  activeRole: "athlete",
  isAdmin: false,
  setActiveRole: () => {},
  refreshProfiles: async () => {},
  signOut: async () => {},
});

function loadStoredRole(): Role {
  try {
    const r = localStorage.getItem(ACTIVE_ROLE_KEY);
    if (r === "coach" || r === "athlete") return r;
  } catch {
    /* ignore */
  }
  return "athlete";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [activeRole, setActiveRoleState] = useState<Role>(loadStoredRole);
  const [isAdmin, setIsAdmin] = useState(false);

  const profile = allProfiles.find((p) => p.role === activeRole) ?? null;

  const setActiveRole = useCallback((role: Role) => {
    setActiveRoleState(role);
    localStorage.setItem(ACTIVE_ROLE_KEY, role);
  }, []);

  const loadProfiles = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setAllProfiles([]);
      setIsAdmin(false);
      return;
    }
    const [{ data }, { data: adminFlag }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", userId),
      supabase.rpc("check_is_admin"),
    ]);
    setAllProfiles((data as Profile[]) ?? []);
    setIsAdmin(Boolean(adminFlag));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setAuthSession(data.session);
      await loadProfiles(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setAuthSession(session);
      await loadProfiles(session?.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfiles]);

  return (
    <AuthContext.Provider
      value={{
        loading,
        authSession,
        profile,
        allProfiles,
        activeRole,
        isAdmin,
        setActiveRole,
        refreshProfiles: () => loadProfiles(authSession?.user.id),
        signOut: async () => {
          await supabase.auth.signOut();
          setAllProfiles([]);
          setIsAdmin(false);
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Sign up + create the profile row for the portal's role. */
export async function signUpWithRole(email: string, password: string, role: Role, displayName: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message, needsConfirm: false };
  if (!data.user) return { error: "Signup failed", needsConfirm: false };
  if (!data.session) return { error: null, needsConfirm: true };

  const { error: profileError } = await supabase.from("profiles").insert({
    user_id: data.user.id,
    role,
    display_name: displayName,
  });

  if (profileError) {
    // Race with auth listener or retry — profile may already exist
    if (profileError.code === "23505") return { error: null, needsConfirm: false };
    return { error: profileError.message, needsConfirm: false };
  }
  return { error: null, needsConfirm: false };
}

/** Create a missing profile after first sign-in (e.g. confirmed-by-email users). */
export async function ensureProfile(role: Role, displayName: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "Not signed in";

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", role)
    .maybeSingle();

  if (existing) return null;

  const { error } = await supabase.from("profiles").insert({
    user_id: data.user.id,
    role,
    display_name: displayName,
  });
  if (error?.code === "23505") return null;
  return error ? error.message : null;
}

/** Request the other role profile (pending admin approval). */
export async function enableRole(role: Role): Promise<{ error: string | null; profileId: string | null }> {
  const { data, error } = await supabase.rpc("enable_role", { p_role: role });
  if (error) return { error: error.message, profileId: null };
  return { error: null, profileId: data as string };
}
