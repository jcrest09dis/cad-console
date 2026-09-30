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
            {event.status === 'active' ? (
              <button
                className="button button-danger"
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Close "${event.name}"? Any units still assigned to it will be returned to the pool ` +
                      '(unassigned) with their crew cleared, any of their active assignments will be cancelled, ' +
                      'and everyone still checked in will be checked out. This can be undone later with Reopen, ' +
                      'but units and staff will need to be reassigned/checked in manually.'
                    )
                  ) {
                    return;
                  }
                  await adminApi.closeEvent(event.id);
                  onRefresh();
                }}
              >
                Close
              </button>
            ) : (
              <button
                className="button"
                onClick={async () => {
                  await adminApi.reopenEvent(event.id);
                  onRefresh();
                }}
              >
                Reopen
              </button>
            )}
                        <button
              className="button button-danger"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Permanently delete "${event.name}"? This deletes every incident on it (and their assignment ` +
                    'history, notes, and outbox messages) and removes it entirely - this cannot be undone. ' +
                    'Units assigned to it will be returned to the pool, not deleted.'
                  )
                ) {
                  return;
                }
                try {
                  await adminApi.deleteEvent(event.id);
                  onRefresh();
                } catch (err) {
                  setError(err.message);
                }
              }}
            >
              Delete
            </button>
          </div>
          {expandedEventId === event.id && <EventDrilldown eventId={event.id} staff={staff} />}
        </div>
      ))}
    </div>
  );
}

// Staffing and unit assignment for one event. Unit creation and crewing
// still live in their own top-level "Units" tab (AdminUnitsTab.jsx) - this
// is just the "which units are working this event" view, so a dispatcher
// setting up an event doesn't have to bounce over to a different tab and
// assign units one at a time.
function EventDrilldown({ eventId, staff }) {
  const [staffing, setStaffing] = useState(null);
  const [staffingStaffId, setStaffingStaffId] = useState('');
  const [staffingRole, setStaffingRole] = useState('field_staff');
  const [units, setUnits] = useState(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function loadStaffing() {
    adminApi.listStaffing(eventId).then(setStaffing).catch((err) => setError(err.message));
  }

  function loadUnits() {
    adminApi.listAllUnits().then(setUnits).catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadStaffing();
    loadUnits();
    setSelectedUnitIds(new Set());
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

  function toggleUnitSelected(unitId) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  }

  async function handleAssignSelected() {
    if (selectedUnitIds.size === 0) return;
    setError(null);
    setBusy(true);
    try {
      for (const unitId of selectedUnitIds) {
        await adminApi.assignUnitEvent(unitId, eventId);
      }
      setSelectedUnitIds(new Set());
      loadUnits();
    } catch (err) {
      setError(err.message);
      loadUnits();
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveUnit(unitId) {
    setError(null);
    try {
      await adminApi.assignUnitEvent(unitId, null);
      loadUnits();
    } catch (err) {
      setError(err.message);
    }
  }

  const assignedUnits = (units ?? []).filter((u) => u.event_id === eventId);
  const availableUnits = (units ?? []).filter((u) => u.event_id !== eventId);

  return (
    <div className="admin-drilldown">
      {error && <p className="error-text">{error}</p>}

      <p className="admin-section-title">Units on this event ({assignedUnits.length})</p>
      {units === null && <p className="empty-state">Loading…</p>}
      {units !== null && assignedUnits.length === 0 && (
        <p className="empty-state">No units assigned yet.</p>
      )}
      {assignedUnits.map((unit) => (
        <div className="admin-list-row" key={unit.id}>
          <div className="admin-list-row-main">{unit.label}</div>
          <button className="button" onClick={() => handleRemoveUnit(unit.id)}>
            Remove
          </button>
        </div>
      ))}

      <p className="admin-section-title" style={{ marginTop: 16 }}>
        Assign units
      </p>
      {units !== null && availableUnits.length === 0 && (
        <p className="empty-state">Every unit is already on this event.</p>
      )}
      {availableUnits.length > 0 && (
        <>
          <div className="admin-drilldown" style={{ maxHeight: 260, overflowY: 'auto' }}>
            {availableUnits.map((unit) => (
              <label key={unit.id} className="admin-list-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectedUnitIds.has(unit.id)}
                  onChange={() => toggleUnitSelected(unit.id)}
                  style={{ marginRight: 4 }}
                />
                <div className="admin-list-row-main">
                  {unit.label}
                  <span className="admin-list-row-sub">
                    {' '}
                    — {unit.event_name ? `currently on ${unit.event_name}` : 'unassigned'}
                  </span>
                </div>
              </label>
            ))}
          </div>
          <button
            className="button button-primary"
            style={{ marginTop: 8 }}
            onClick={handleAssignSelected}
            disabled={busy || selectedUnitIds.size === 0}
          >
            {busy ? 'Assigning…' : `Assign ${selectedUnitIds.size} selected unit${selectedUnitIds.size === 1 ? '' : 's'}`}
          </button>
        </>
      )}

      <p className="admin-section-title" style={{ marginTop: 20 }}>
        Staffing
      </p>
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