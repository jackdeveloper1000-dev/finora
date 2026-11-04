import { Navigate, Route, Routes } from 'react-router-dom';
import FilingLayout from './components/filing/FilingLayout';
import AppShell from './components/layout/AppShell';
import { GuestRoute, ProtectedRoute, RoleRoute } from './components/layout/RouteGuards';
import Dashboard from './pages/Dashboard';
import Documents from './pages/Documents';
import ExpertQueue from './pages/ExpertQueue';
import ExpertReview from './pages/ExpertReview';
import FileItr from './pages/FileItr';
import ForgotPassword from './pages/ForgotPassword';
import History from './pages/History';
import Landing from './pages/Landing';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import Notifications from './pages/Notifications';
import QuickFile from './pages/QuickFile';
import Reconcile from './pages/Reconcile';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Return from './pages/Return';
import Settings from './pages/Settings';
import Start from './pages/Start';
import Tax from './pages/Tax';
import Transactions from './pages/Transactions';
import VerifyEmail from './pages/VerifyEmail';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<GuestRoute redirectTo="/settings" />}>
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="notifications" element={<Notifications />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Navigate to="/settings" replace />} />

          <Route element={<RoleRoute />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="quick" element={<QuickFile />} />
            <Route path="file" element={<Navigate to="/quick" replace />} />
            <Route path="history" element={<History />} />
            <Route path="cases/:caseId" element={<FilingLayout />}>
              <Route index element={<Navigate to="start" replace />} />
              <Route path="start" element={<Start />} />
              <Route path="documents" element={<Documents />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="reconcile" element={<Reconcile />} />
              <Route path="tax" element={<Tax />} />
              <Route path="itr" element={<Return />} />
              <Route path="file-itr" element={<FileItr />} />
            </Route>
          </Route>

          <Route element={<RoleRoute staff />}>
            <Route path="expert" element={<ExpertQueue />} />
            <Route path="expert/reviews/:reviewId" element={<ExpertReview />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
