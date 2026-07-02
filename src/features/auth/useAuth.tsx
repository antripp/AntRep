import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session as AuthSession } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase";
import type { Profile, Role } from "../../lib/types";

interface AuthState {
  loading: boolean;
  authSession: AuthSession | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  authSession: null,
  profile: null,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  async function loadProfile(userId: string | undefined) {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", userId)
      .maybeSingle();
    setProfile((data as Profile) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setAuthSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setAuthSession(session);
      await loadProfile(session?.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        loading,
        authSession,
        profile,
        refreshProfile: () => loadProfile(authSession?.user.id),
        signOut: async () => {
          await supabase.auth.signOut();
          setProfile(null);
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
  if (!data.session) return { error: null, needsConfirm: true }; // email confirmation enabled
  const { error: profileError } = await supabase
    .from("profiles")
    .insert({ id: data.user!.id, role, display_name: displayName });
  if (profileError) return { error: profileError.message, needsConfirm: false };
  return { error: null, needsConfirm: false };
}

/** Create a missing profile after first sign-in (e.g. confirmed-by-email users). */
export async function ensureProfile(role: Role, displayName: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return "Not signed in";
  const { error } = await supabase
    .from("profiles")
    .insert({ id: data.user.id, role, display_name: displayName });
  return error ? error.message : null;
}
