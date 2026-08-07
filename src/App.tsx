import { Route, Routes } from "react-router-dom";
import Portal from "./app/Portal";
import { isDemoMode } from "./data";
import ClassicAthleteApp from "./features/athlete/AthleteApp";
import ClassicCoachApp from "./features/coach/CoachApp";
import { AuthProvider as ClassicAuthProvider } from "./features/auth/useAuth";

/**
 * Routes
 *   /            athlete portal (the AntRep app)
 *   /coach       coach portal
 *   /classic     the previous coach/athlete UI, kept while the new one settles
 */
export default function App() {
  return (
    <Routes>
      <Route path="/coach/*" element={<Portal role="coach" />} />


      {!isDemoMode && (
        <Route
          path="/classic/coach/*"
          element={
            <ClassicAuthProvider>
              <ClassicCoachApp />
            </ClassicAuthProvider>
          }
        />
      )}
      {!isDemoMode && (
        <Route
          path="/classic/*"
          element={
            <ClassicAuthProvider>
              <ClassicAthleteApp />
            </ClassicAuthProvider>
          }
        />
      )}

      <Route path="/*" element={<Portal role="athlete" />} />
    </Routes>
  );
}
