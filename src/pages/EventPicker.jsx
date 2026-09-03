import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function EventPicker({ onSelect, isAdmin, canViewReports, onAdminMode, onReportsMode }) {
  const [myEvents, setMyEvents] = useState(null);
  const [activeEvents, setActiveEvents] = useState(null);
  const [error, setError] = useState(null);
  const [checkingInId, setCheckingInId] = useState(null);

  function loadMyEvents() {
    return api.myEvents().then(setMyEvents);
  }

  useEffect(() => {
    loadMyEvents().catch((err) => setError(err.message));
    api
      .activeEvents()
      .then(setActiveEvents)
      .catch((err) => setError(err.message));
  }, []);

  async function handleCheckIn(eventId) {
    setError(null);
    setCheckingInId(eventId);
    try {
      await api.checkIn(eventId);
      await loadMyEvents();
    } catch (err) {
      setError(err.message);
    } finally {
      setCheckingInId(null);
    }
  }

  const myEventIds = new Set((myEvents ?? []).map((e) => e.id));
  const checkInCandidates = (activeEvents ?? []).filter((e) => !myEventIds.has(e.id));

  return (
    <div className="event-picker">
      <div className="event-picker-card">
        <p className="login-title">Choose an event</p>
        <p className="login-sub">You're checked into the following events.</p>

        {isAdmin && (
          <button type="button" className="text-button" onClick={onAdminMode} style={{ marginBottom: 16 }}>
            Open admin tools
          </button>
        )}
        {canViewReports && (
          <button
            type="button"
            className="text-button"
            onClick={onReportsMode}
            style={{ marginBottom: 16, marginLeft: isAdmin ? 16 : 0 }}
          >
            Incident history
          </button>
        )}

        {error && <p className="error-text">{error}</p>}
        {myEvents && myEvents.length === 0 && (
          <p className="empty-state">You're not checked into any events yet.</p>
        )}
        {myEvents?.map((event) => (
          <button key={event.id} className="event-option" onClick={() => onSelect(event)}>
            <div className="event-option-name">{event.name}</div>
            <div className="event-option-sub">
              {event.role_for_event === 'dispatcher'
                ? `Dispatching at ${event.venue_name}`
                : `Live view at ${event.venue_name}`}
            </div>
          </button>
        ))}

        {checkInCandidates.length > 0 && (
          <div className="panel-section">
            <p className="panel-section-title">Check into another event</p>
            {checkInCandidates.map((event) => (
              <div key={event.id} className="event-option" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div className="event-option-name">{event.name}</div>
                  <div className="event-option-sub">{event.venue_name}</div>
                </div>
                <button
                  className="button"
                  onClick={() => handleCheckIn(event.id)}
                  disabled={checkingInId === event.id}
                >
                  {checkingInId === event.id ? 'Checking in…' : 'Check in'}
                </button>
              </div>
            ))}
            <p className="empty-state" style={{ padding: '8px 0 0' }}>
              Checking in grants field-staff access. A dispatcher role has to be
              set by an admin.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
