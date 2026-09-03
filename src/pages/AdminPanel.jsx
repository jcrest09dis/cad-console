import { useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';
import AdminStaffTab from '../components/AdminStaffTab.jsx';
import AdminVenuesTab from '../components/AdminVenuesTab.jsx';
import AdminEventsTab from '../components/AdminEventsTab.jsx';
import AdminUnitsTab from '../components/AdminUnitsTab.jsx';

const TABS = ['Staff', 'Venues', 'Events', 'Units'];

export default function AdminPanel({ onExit }) {
  const [tab, setTab] = useState('Staff');
  const [staff, setStaff] = useState(null);
  const [venues, setVenues] = useState(null);
  const [events, setEvents] = useState(null);

  function refreshStaff() {
    adminApi.listStaff().then(setStaff);
  }
  function refreshVenues() {
    adminApi.listVenues().then(setVenues);
  }
  function refreshEvents() {
    adminApi.listEvents().then(setEvents);
  }

  useEffect(() => {
    refreshStaff();
    refreshVenues();
    refreshEvents();
  }, []);

  return (
    <div className="admin-shell">
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">CAD Console</span>
          <span className="topbar-event">Admin tools</span>
        </div>
        <div className="topbar-right">
          <button className="text-button" onClick={onExit}>
            Exit admin
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="admin-body">
        {tab === 'Staff' && <AdminStaffTab staff={staff} onRefresh={refreshStaff} />}
        {tab === 'Venues' && <AdminVenuesTab venues={venues} onRefresh={refreshVenues} />}
        {tab === 'Events' && (
          <AdminEventsTab events={events} venues={venues} staff={staff} onRefresh={refreshEvents} />
        )}
        {tab === 'Units' && <AdminUnitsTab events={events} staff={staff} />}
      </div>
    </div>
  );
}
