/** Account + role state for the new AntRep app (works in demo and Supabase mode). */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "../data";
import type { AuthUser } from "../data/api";
import type { Profile, Role } from "../data/types";

interface AuthValue {
  loading: boolean;
  user: AuthUser | null;
  profiles: Profile[];
  /** Profile for the portal currently open. */
  profile: Profile | null;
  role: Role;
  setRole: (role: Role) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  loading: true,
  user: null,
  profiles: [],
  profile: null,
  role: "athlete",
  setRole: () => {},
  refresh: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ role, children }: { role: Role; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeRole, setActiveRole] = useState<Role>(role);

  useEffect(() => setActiveRole(role), [role]);

  const load = useCallback(
    async (nextUser: AuthUser | null) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfiles([]);
        setLoading(false);
        return;
      }

      let mine = await api.myProfiles();

      if (nextUser.emailConfirmed) {
        // Sign-up can't write the profile — with confirmation on there's no
        // session yet — so the first confirmed load creates it.
        if (mine.length === 0) {
          await api.ensureProfile(role, "");
          mine = await api.myProfiles();
        }
        // And clear the verification requirement now that it's satisfied.
        if (mine.some((p) => p.requires_email_verification)) {
          if (await api.markEmailVerified()) mine = await api.myProfiles();
        }
      }

      setProfiles(mine);
      setLoading(false);
    },
    [role],
  );

  useEffect(() => {
    let cancelled = false;
    api.currentUser().then((u) => {
      if (!cancelled) load(u);
    });
    const unsubscribe = api.onAuthChange((u) => {
      if (!cancelled) load(u);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [load]);

  const value = useMemo<AuthValue>(
    () => ({
      loading,
      user,
      profiles,
      profile: profiles.find((p) => p.role === activeRole) ?? null,
      role: activeRole,
      setRole: setActiveRole,
      refresh: async () => load(await api.currentUser()),
      signOut: async () => {
        await api.signOut();
        setProfiles([]);
        setUser(null);
      },
    }),
    [loading, user, profiles, activeRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
