import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PageLoader } from '../ui/StateView';

const homeFor = (user) => (user.role === 'customer' ? '/dashboard' : '/expert');

export function ProtectedRoute() {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <PageLoader />;
  return user ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

export function GuestRoute({ redirectTo }) {
  const { user, booting } = useAuth();
  const location = useLocation();
  if (booting) return <PageLoader />;
  return user ? <Navigate to={redirectTo && user.role === 'customer' ? redirectTo : location.state?.from ?? homeFor(user)} replace /> : <Outlet />;
}

// Keeps each role in its own area: customers file returns, staff review them.
export function RoleRoute({ staff = false }) {
  const { user } = useAuth();
  return (user.role !== 'customer') === staff ? <Outlet /> : <Navigate to={homeFor(user)} replace />;
}
