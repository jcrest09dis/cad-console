import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import { useLiveSocket } from '../hooks/useLiveSocket.js';
import {
  unitRowClass,
  unitBadgeClass,
  unitStatusLabel,
  incidentRowClass,
  incidentBadgeClass,
  assignmentBadgeClass,
  assignmentStatusLabel,
} from '../statusStyles.js';

/**
 * Read-only situational-awareness view for field staff who don't have
 * the native app (currently: iOS - see the field app's README on why
 * that's not a standalone build yet). Deliberately has no interactive
 * controls at all - no ack, no status changes, no assign/resolve - this
 * is purely "what's happening right now," reusing the exact same
 * REST endpoints and WebSocket channel the full dispatcher board uses.
 * If this needs to become interactive later (ack/status from a phone
 * browser), that's a bigger RBAC-aware addition, not a small extension
 * of this page.
 */
export default function LiveViewPage({ event, staffName, onChangeEvent, onLogOut }) {
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);

  const { data: units, refresh: refreshUnits } = usePolling(() => api.units(event.id), [event.id], 20000);
  const { data: incidents, refresh: refreshIncidents } = usePolling(
    () => api.incidents(event.id),
    [event.id],
    20000
  );
  const { data: assignments, refresh: refreshAssignments } = usePolling(
    () => api.assignments(event.id),
    [event.id],
    20000
  );

  function refreshAll() {
    refreshUnits();
    refreshIncidents();
    refreshAssignments();
  }

  const isLive = useLiveSocket(event.id, refreshAll);

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const incidentById = new Map((incidents ?? []).map((i) => [i.id, i]));
  const assignmentByIncidentId = new Map((assignments ?? []).map((a) => [a.incident_id, a]));
  const assignmentByUnitId = new Map((assignments ?? []).map((a) => [a.unit_id, a]));

  const openIncidents = (incidents ?? []).filter((i) => i.status === 'OPEN' || i.status === 'DISPATCHED');
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sortedIncidents = [...openIncidents].sort((a, b) => {
    const aAlert = assignmentByIncidentId.get(a.id)?.status === 'UNCONFIRMED';
    const bAlert = assignmentByIncidentId.get(b.id)?.status === 'UNCONFIRMED';
    if (aAlert !== bAlert) return aAlert ? -1 : 1;
    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  const selectedIncident = selectedIncidentId ? incidentById.get(selectedIncidentId) : null;

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">CAD Live View</span>
          <span className="topbar-event">{event.name}</span>
          <span
            className="live-indicator"
            title={isLive ? 'Live updates connected' : 'Live updates disconnected - falling back to polling'}
          >
            <span className={`live-dot ${isLive ? 'live-dot-on' : 'live-dot-off'}`} />
            {isLive ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
        <div className="topbar-right">
          <span>{staffName}</span>
          <button className="text-button" onClick={onChangeEvent}>
            Switch event
          </button>
          <button className="text-button" onClick={onLogOut}>
            Log out
          </button>
        </div>
      </div>

      <div className="live-view-body">
        <p className="admin-section-title">Units</p>
        {units === null && <p className="empty-state">Loading…</p>}
        {units?.length === 0 && <p className="empty-state">No units set up for this event yet.</p>}
        {units?.map((unit) => {
          const assignment = assignmentByUnitId.get(unit.id);
          const assignedIncident = assignment ? incidentById.get(assignment.incident_id) : null;
          return (
            <div key={unit.id} className={`row ${unitRowClass(unit.status)}`}>
              <div className="row-main">
                <div className="row-title">{unit.label}</div>
                {assignedIncident && (
                  <div className="row-sub">
                    {assignedIncident.zone_label ?? 'Unknown location'} — {assignedIncident.type}
                  </div>
                )}
              </div>
              <span className={unitBadgeClass(unit.status)}>{unitStatusLabel(unit.status)}</span>
            </div>
          );
        })}

        <p className="admin-section-title" style={{ marginTop: 24 }}>
          Incidents
        </p>
        {incidents === null && <p className="empty-state">Loading…</p>}
        {incidents !== null && sortedIncidents.length === 0 && <p className="empty-state">No open incidents.</p>}
        {sortedIncidents.map((incident) => {
          const assignment = assignmentByIncidentId.get(incident.id);
          const assignedUnit = assignment ? unitById.get(assignment.unit_id) : null;
          return (
            <div
              key={incident.id}
              className={`row clickable ${incidentRowClass(incident.priority, assignment?.status)}`}
              onClick={() => setSelectedIncidentId(incident.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setSelectedIncidentId(incident.id)}
            >
              <div className="row-main">
                <div className="row-title">{incident.zone_label ?? 'Unknown location'}</div>
                <div className="row-sub">
                  {incident.type}
                  {assignedUnit ? ` — assigned to ${assignedUnit.label}` : ' — unassigned'}
                </div>
              </div>
              <span className={incidentBadgeClass(incident.priority)}>{incident.priority}</span>
            </div>
          );
        })}
      </div>

      {selectedIncident && (
        <ReadOnlyNotesPanel
          incident={selectedIncident}
          eventId={event.id}
          assignment={assignmentByIncidentId.get(selectedIncident.id)}
          assignedUnitLabel={
            assignmentByIncidentId.get(selectedIncident.id)
              ? unitById.get(assignmentByIncidentId.get(selectedIncident.id).unit_id)?.label
              : null
          }
          onClose={() => setSelectedIncidentId(null)}
        />
      )}
    </div>
  );
}

function ReadOnlyNotesPanel({ incident, eventId, assignment, assignedUnitLabel, onClose }) {
  const [revisions, setRevisions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .getNotes(eventId, incident.id)
      .then((res) => setRevisions(res.revisions ?? []))
      .catch((err) => setError(err.message));
  }, [incident.id]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-header">
          <div>
            <p className="side-panel-title">{incident.zone_label ?? 'Unknown location'}</p>
            <p className="login-sub" style={{ margin: 0 }}>
              {incident.type}, {incident.priority} priority — {incident.status.toLowerCase()}
            </p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {assignment && (
          <div className="panel-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <p className="panel-section-title">Assignment</p>
            <div className="row row-bar-progress" style={{ marginBottom: 0 }}>
              <div className="row-main">
                <div className="row-title">{assignedUnitLabel ?? 'Unit'}</div>
              </div>
              <span className={assignmentBadgeClass(assignment.status)}>
                {assignmentStatusLabel(assignment.status)}
              </span>
            </div>
          </div>
        )}

        <div className="panel-section">
          <p className="panel-section-title">Notes</p>
          {error && <p className="error-text">{error}</p>}
          {revisions === null && !error && <p className="empty-state">Loading…</p>}
          {revisions?.length === 0 && <p className="empty-state">No notes yet.</p>}
          {[...(revisions ?? [])].reverse().map((rev) => (
            <div key={rev.id} style={{ marginBottom: 10 }}>
              <div className="row-sub">
                {rev.authorName}, {new Date(rev.createdAt).toLocaleString()}
              </div>
              <div className="notes-content">{rev.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
