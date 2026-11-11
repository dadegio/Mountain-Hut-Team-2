import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../hooks/useAuth.ts";

interface RequireRoleProps {
  allow: string[]; // user types that may see the page, e.g. ["HIKER"]
  guestAllowed?: boolean; // true = logged-out visitors may see it too
}

export default function RequireRole({ allow, guestAllowed = false }: RequireRoleProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // wait for /me, otherwise a logged-in user gets bounced on page refresh
  if (loading) return <p className="text-stone-500">Loading…</p>;

  if (!user) {
    return guestAllowed ? (
      <Outlet />
    ) : (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  if (!allow.includes(user.type)) return <Navigate to="/" replace />;

  return <Outlet />;
}