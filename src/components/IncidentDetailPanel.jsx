import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { assignmentBadgeClass, assignmentStatusLabel, unitBadgeClass, unitStatusLabel } from '../statusStyles.js';

// Same progression the field app and UnitDetailPanel offer - a
// dispatcher can set any of these directly (not just "next"), since
// they have override authority, matching their existing ability to
// cancel/complete assignments freely. Lets a dispatcher who's already
// in this panel adding notes also move the unit along, without needing
// to close this and separately click into the unit.
const PROGRESSION_STATUSES = ['ENROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_DESTINATION'];

export default function IncidentDetailPanel({
  incident,
  eventId,
  zoneLabel,
  units,
  assignment,
  onClose,
  onChanged,
}) {
  const [revisions, setRevisions] = useState([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .getNotes(eventId, incident.id)
      .then((res) => setRevisions(res.revisions ?? []))
      .catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incident.id]);

  const availableUnits = units.filter((u) => u.status === 'AVAILABLE');
  const assignedUnit = assignment ? units.find((u) => u.id === assignment.unit_id) : null;

  async function withBusy(fn) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleAssign() {
    if (!selectedUnitId) return;
    withBusy(() => api.createAssignment(eventId, incident.id, selectedUnitId));
  }

  function handleDispatcherAck() {
    withBusy(() => api.dispatcherAckAssignment(eventId, assignment.id));
  }

  function handleSetUnitStatus(status) {
    withBusy(() => api.setUnitStatus(eventId, assignedUnit.id, status));
  }

  function handleCancelAssignment() {
    withBusy(() => api.cancelAssignment(eventId, assignment.id));
  }

  function handleCompleteAssignment() {
    withBusy(() => api.completeAssignment(eventId, assignment.id));
  }

  function handleResolve() {
    withBusy(() => api.setIncidentStatus(eventId, incident.id, 'RESOLVED'));
  }

  function handleCancelIncident() {
    withBusy(() => api.setIncidentStatus(eventId, incident.id, 'CANCELLED'));
  }

  function handleSaveNote() {
    if (!noteDraft.trim()) return;
    withBusy(async () => {
      await api.addNote(eventId, incident.id, noteDraft.trim());
      const res = await api.getNotes(eventId, incident.id);
      setRevisions(res.revisions ?? []);
      setNoteDraft('');
    });
  }

  function handleNoteKeyDown(e) {
    // Enter submits; Shift+Enter still inserts a newline for a
    // multi-line note, matching the common chat-input convention.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveNote();
    }
  }

  const isTerminal = incident.status === 'RESOLVED' || incident.status === 'CANCELLED';

  return (
    <div className="overlay" onClick={onClose}>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-header">
          <div>
            <p className="side-panel-title">{zoneLabel ?? 'Unknown zone'}</p>
            <p className="login-sub" style={{ margin: 0 }}>
              {incident.type}, {incident.priority} priority — {incident.status.toLowerCase()}
            </p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="panel-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
          <p className="panel-section-title">Assignment</p>
          {assignment ? (
            <>
              <div className="row row-bar-progress" style={{ marginBottom: 4 }}>
                <div className="row-main">
                  <div className="row-title">{assignedUnit?.label ?? 'Unit'}</div>
                </div>
                <span className={assignmentBadgeClass(assignment.status)}>
                  {assignmentStatusLabel(assignment.status)}
                </span>
              </div>
              {assignment.ack_method === 'dispatcher_override' && (
                <p className="row-sub" style={{ marginBottom: 8 }}>
                  Acknowledged by {assignment.acked_by_name} (confirmed via radio, not the unit's own device)
                </p>
              )}
              <div className="action-row">
                {(assignment.status === 'PENDING' || assignment.status === 'UNCONFIRMED') && (
                  <button className="button button-primary" onClick={handleDispatcherAck} disabled={busy}>
                    Acknowledge for unit (radio)
                  </button>
                )}
                <button className="button" onClick={handleCompleteAssignment} disabled={busy || assignment.status !== 'ACKED'}>
                  Mark complete
                </button>
                <button className="button button-danger" onClick={handleCancelAssignment} disabled={busy}>
                  Cancel assignment
                </button>
              </div>

              {assignment.status === 'ACKED' && assignedUnit && (
                <div style={{ marginTop: 12 }}>
                  <p className="row-sub" style={{ marginBottom: 6 }}>
                    Unit status: <span className={unitBadgeClass(assignedUnit.status)}>
                      {unitStatusLabel(assignedUnit.status)}
                    </span>
                  </p>
                  <div className="action-row">
                    {PROGRESSION_STATUSES.map((status) => (
                      <button
                        key={status}
                        className={`button ${assignedUnit.status === status ? 'button-primary' : ''}`}
                        onClick={() => handleSetUnitStatus(status)}
                        disabled={busy || assignedUnit.status === status}
                      >
                        {unitStatusLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : isTerminal ? (
            <p className="empty-state" style={{ padding: '4px 0' }}>
              No unit was assigned before this incident closed.
            </p>
          ) : (
            <>
              <select
                className="field-select"
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
              >
                <option value="">Select a unit…</option>
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
              <div className="action-row">
                <button className="button button-primary" onClick={handleAssign} disabled={busy || !selectedUnitId}>
                  Assign unit
                </button>
              </div>
              {availableUnits.length === 0 && (
                <p className="empty-state" style={{ padding: '8px 0' }}>No units are currently available.</p>
              )}
            </>
          )}
        </div>

        <div className="panel-section">
          <p className="panel-section-title">Notes</p>
          {!isTerminal && (
            <>
              <textarea
                className="field-textarea"
                placeholder="Add a note… (Enter to save, Shift+Enter for a new line)"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={handleNoteKeyDown}
              />
              <div className="action-row" style={{ marginBottom: 14 }}>
                <button className="button" onClick={handleSaveNote} disabled={busy || !noteDraft.trim()}>
                  Save note
                </button>
              </div>
            </>
          )}
          {revisions.length === 0 && <p className="empty-state" style={{ padding: '4px 0' }}>No notes yet.</p>}
          {[...revisions].reverse().map((rev) => (
            <div key={rev.id} style={{ marginBottom: 10 }}>
              <div className="row-sub">
                {rev.authorName}, {new Date(rev.createdAt).toLocaleString()}
              </div>
              <div className="notes-content">{rev.content}</div>
            </div>
          ))}
        </div>

        {!isTerminal && (
          <div className="panel-section">
            <p className="panel-section-title">Close incident</p>
            <div className="action-row">
              <button className="button button-primary" onClick={handleResolve} disabled={busy}>
                Resolve
              </button>
              <button className="button button-danger" onClick={handleCancelIncident} disabled={busy}>
                Cancel incident
              </button>
            </div>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  );
}