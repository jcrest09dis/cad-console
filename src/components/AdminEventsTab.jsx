import { useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';

export default function AdminEventsTab({ events, venues, staff, onRefresh }) {
  const [name, setName] = useState('');
  const [venueId, setVenueId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !venueId || !startTime) {
      setError('Name, venue, and start time are required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await adminApi.createEvent({
        name: name.trim(),
        venueId,
        startTime: new Date(startTime).toISOString(),
      });
      setName('');
      setVenueId('');
      setStartTime('');
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      <p className="admin-section-title">Add event</p>
      <form className="admin-form-row" onSubmit={handleCreate}>
        <div className="admin-form-field">
          <label>Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="admin-form-field">
          <label>Venue</label>
          <select className="field-select" value={venueId} onChange={(e) => setVenueId(e.target.value)}>
            <option value="">Select…</option>
            {venues?.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form-field">
          <label>Start time</label>
          <input
            className="field-input"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <button className="button button-primary" type="submit" disabled={busy}>
          Add
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <p className="admin-section-title">Events ({events?.length ?? 0})</p>
      {events?.map((event) => (
        <div key={event.id}>
          <div className="admin-list-row">
            <div className="admin-list-row-main">
              <div>{event.name}</div>
              <div className="admin-list-row-sub">
                {event.status} — starts {new Date(event.start_time).toLocaleString()}
              </div>
            </div>
            <button
              className="button"
              onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)}
            >
              {expandedEventId === event.id ? 'Hide' : 'Manage'}
            </button>
            {event.status === 'active' && (
              <button
                className="button button-danger"
                onClick={async () => {
                  await adminApi.closeEvent(event.id);
                  onRefresh();
                }}
              >
                Close
              </button>
            )}
          </div>
          {expandedEventId === event.id && <EventDrilldown eventId={event.id} staff={staff} />}
        </div>
      ))}
    </div>
  );
}

// Staffing only now - unit creation and crew management moved to their
// own top-level "Units" tab (AdminUnitsTab.jsx), since units are their
// own concern and nesting them here made them hard to find.
function EventDrilldown({ eventId, staff }) {
  const [staffing, setStaffing] = useState(null);
  const [staffingStaffId, setStaffingStaffId] = useState('');
  const [staffingRole, setStaffingRole] = useState('field_staff');
  const [error, setError] = useState(null);

  function loadStaffing() {
    adminApi.listStaffing(eventId).then(setStaffing).catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadStaffing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function handleSetStaffing(e) {
    e.preventDefault();
    if (!staffingStaffId) return;
    try {
      await adminApi.setStaffing(eventId, { staffId: staffingStaffId, roleForEvent: staffingRole });
      setStaffingStaffId('');
      loadStaffing();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCheckout(staffId) {
    await adminApi.checkoutStaffing(eventId, staffId);
    loadStaffing();
  }

  return (
    <div className="admin-drilldown">
      {error && <p className="error-text">{error}</p>}

      <p className="admin-section-title">Staffing</p>
      <form className="admin-form-row" onSubmit={handleSetStaffing}>
        <div className="admin-form-field">
          <label>Staff</label>
          <select
            className="field-select"
            value={staffingStaffId}
            onChange={(e) => setStaffingStaffId(e.target.value)}
          >
            <option value="">Select…</option>
            {staff?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-form-field">
          <label>Role for this event</label>
          <select className="field-select" value={staffingRole} onChange={(e) => setStaffingRole(e.target.value)}>
            <option value="field_staff">Field staff</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button className="button" type="submit">
          Check in / set role
        </button>
      </form>
      {staffing?.length === 0 && <p className="empty-state">No one checked in yet.</p>}
      {staffing?.map((entry) => (
        <div className="admin-list-row" key={entry.id}>
          <div className="admin-list-row-main">
            {entry.name}
            <span className="admin-list-row-sub">
              {' '}
              — {entry.role_for_event}
              {entry.checked_out_at ? ', checked out' : ', checked in'}
            </span>
          </div>
          {!entry.checked_out_at && (
            <button className="button" onClick={() => handleCheckout(entry.staff_id)}>
              Check out
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
