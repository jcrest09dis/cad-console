import { useState } from 'react';
import { api } from '../api.js';
import { unitBadgeClass, unitStatusLabel } from '../statusStyles.js';

// Matches the backend's VALID_STATUSES in routes/units.js exactly.
// AVAILABLE isn't in here on purpose - it's only ever reached via
// completing/cancelling an assignment (or an incident resolve/cancel
// cascade), never set directly, or unit.current_assignment_id would go
// stale while status claims AVAILABLE.
const PROGRESSION_STATUSES = ['ENROUTE', 'ON_SCENE', 'TRANSPORTING', 'AT_DESTINATION'];

export default function UnitDetailPanel({ unit, assignment, eventId, onClose, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // The four progression stages require a live ACKED assignment - same
  // rule the backend enforces (units.js). OUT_OF_SERVICE is the only
  // one that's always available, matching the design's "can go out of
  // service at any time" rule from the original whiteboard.
  const canProgress = assignment?.status === 'ACKED';
  const isOutOfService = unit.status === 'OUT_OF_SERVICE';

  async function handleSetStatus(status) {
    setError(null);
    setBusy(true);
    try {
      await api.setUnitStatus(eventId, unit.id, status);
      onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-header">
          <div>
            <p className="side-panel-title">{unit.label}</p>
            <span className={unitBadgeClass(unit.status)}>{unitStatusLabel(unit.status)}</span>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="panel-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
          <p className="panel-section-title">Set status</p>

          {canProgress ? (
            <div className="action-row">
              {PROGRESSION_STATUSES.map((status) => (
                <button
                  key={status}
                  className={`button ${unit.status === status ? 'button-primary' : ''}`}
                  onClick={() => handleSetStatus(status)}
                  disabled={busy || unit.status === status}
                >
                  {unitStatusLabel(status)}
                </button>
              ))}
            </div>
          ) : isOutOfService ? (
            <div className="action-row">
              <button className="button button-primary" onClick={() => handleSetStatus('AVAILABLE')} disabled={busy}>
                Return to service
              </button>
            </div>
          ) : (
            <p className="empty-state" style={{ padding: '4px 0' }}>
              This unit has no acknowledged assignment, so it can't progress past available.
            </p>
          )}

          <div className="action-row" style={{ marginTop: 12 }}>
            <button
              className="button button-danger"
              onClick={() => handleSetStatus('OUT_OF_SERVICE')}
              disabled={busy || isOutOfService}
            >
              Mark out of service
            </button>
          </div>

          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </div>
  );
}
