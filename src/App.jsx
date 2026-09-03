import { useEffect, useState } from 'react';
import { api, loadStoredToken, setAuthToken } from './api.js';
import Login from './pages/Login.jsx';
import EventPicker from './pages/EventPicker.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveViewPage from './pages/LiveViewPage.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import ReportsPage from './pages/ReportsPage.jsx';

export default function App() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [staff, setStaff] = useState(null);
  const [event, setEvent] = useState(null);
  const [mode, setMode] = useState('staff'); // 'staff' | 'admin' | 'reports'

  useEffect(() => {
    const token = loadStoredToken();
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api
      .me()
      .then(setStaff)
      .catch(() => setAuthToken(null))
      .finally(() => setCheckingSession(false));
  }, []);

  function handleLoggedIn() {
    api.me().then(setStaff);
  }

  function handleLogOut() {
    setAuthToken(null);
    setStaff(null);
    setEvent(null);
    setMode('staff');
  }

  if (checkingSession) return null;
  if (!staff) return <Login onLoggedIn={handleLoggedIn} />;

  // Admin tools and Reports are both properties of the logged-in account
  // (staff.is_admin / staff.canViewReports), not separate secret-gated
  // modes - entering either just shows that screen using the same
  // session, exiting just goes back.
  if (mode === 'admin' && staff.is_admin) {
    return <AdminPanel onExit={() => setMode('staff')} />;
  }
  if (mode === 'reports' && staff.canViewReports) {
    return <ReportsPage onExit={() => setMode('staff')} />;
  }

  if (!event) {
    return (
      <EventPicker
        onSelect={setEvent}
        isAdmin={staff.is_admin}
        canViewReports={staff.canViewReports}
        onAdminMode={() => setMode('admin')}
        onReportsMode={() => setMode('reports')}
      />
    );
  }

  // Dispatchers get the full control board (drag-and-drop, admin
  // controls). Field staff get the read-only live view instead - see
  // LiveViewPage.jsx for why (originally built as a browser-based
  // fallback for staff without the native field app, e.g. iOS before
  // that gets a standalone build).
  if (event.role_for_event === 'field_staff') {
    return (
      <LiveViewPage
        event={event}
        staffName={staff.name}
        onChangeEvent={() => setEvent(null)}
        onLogOut={handleLogOut}
      />
    );
  }

  return (
    <Dashboard
      event={event}
      staffName={staff.name}
      isAdmin={staff.is_admin}
      canViewReports={staff.canViewReports}
      onAdminMode={() => setMode('admin')}
      onReportsMode={() => setMode('reports')}
      onChangeEvent={() => setEvent(null)}
      onLogOut={handleLogOut}
    />
  );
}
