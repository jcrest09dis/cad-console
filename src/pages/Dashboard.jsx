import { useState } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import { useLiveSocket } from '../hooks/useLiveSocket.js';
import UnitRow from '../components/UnitRow.jsx';
import IncidentRow, { DRAG_MIME } from '../components/IncidentRow.jsx';
import UnitDetailPanel from '../components/UnitDetailPanel.jsx';
import IncidentDetailPanel from '../components/IncidentDetailPanel.jsx';
import NewIncidentPanel from '../components/NewIncidentPanel.jsx';

export default function Dashboard({ event, staffName, isAdmin, canViewReports, onAdminMode, onReportsMode, onChangeEvent, onLogOut }) {
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [dropError, setDropError] = useState(null);

  // WebSocket is now the primary way this screen learns about changes -
  // polling underneath it is lengthened to a resilience backstop (used
  // to be 4s/primary; see useLiveSocket.js for why it's not removed
  // outright).
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
  // Zones are no longer used to look up incident display labels (the
  // incidents/assignments APIs return zone_label directly now, since
  // location is free text) - kept only to feed NewIncidentPanel's
  // suggestion datalist.
  const { data: zones } = usePolling(() => api.zones(event.id), [event.id], 60000);

  function refreshAll() {
    refreshUnits();
    refreshIncidents();
    refreshAssignments();
  }

  const isLive = useLiveSocket(event.id, refreshAll);

  function handleUnitDragStart(e, unit) {
    e.dataTransfer.setData(DRAG_MIME, unit.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  async function handleDropUnit(unitId, incidentId) {
    setDropError(null);
    try {
      await api.createAssignment(event.id, incidentId, unitId);
      refreshAll();
    } catch (err) {
      // Most likely a race - the unit or incident got taken by someone
      // else between drag-start and drop (e.g. another dispatcher, or
      // an ack/escalation landing in between). Surface it briefly rather
      // than fail silently; refresh so the board reflects reality either way.
      setDropError(err.message);
      refreshAll();
    }
  }

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const incidentById = new Map((incidents ?? []).map((i) => [i.id, i]));
  const assignmentByIncidentId = new Map((assignments ?? []).map((a) => [a.incident_id, a]));
  const assignmentByUnitId = new Map((assignments ?? []).map((a) => [a.unit_id, a]));

  const selectedUnit = selectedUnitId ? unitById.get(selectedUnitId) : null;

  const openIncidents = (incidents ?? []).filter((i) => i.status === 'OPEN' || i.status === 'DISPATCHED');
  const selectedIncident = openIncidents.find((i) => i.id === selectedIncidentId) ?? null;
  const selectedAssignment = selectedIncident ? assignmentByIncidentId.get(selectedIncident.id) : null;

  // Sort: UNCONFIRMED assignments first (needs a human now), then by priority.
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sortedIncidents = [...openIncidents].sort((a, b) => {
    const aAlert = assignmentByIncidentId.get(a.id)?.status === 'UNCONFIRMED';
    const bAlert = assignmentByIncidentId.get(b.id)?.status === 'UNCONFIRMED';
    if (aAlert !== bAlert) return aAlert ? -1 : 1;
    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-left">
	  <img src="/uk-wildcat-logo.png" alt="UK Wildcats" className="topbar-logo" />
	  <img src="/uk-athletics-logo.png" alt="UK Athletics" className="topbar-logo" />
          <span className="topbar-title">CAD Console</span>
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
          {isAdmin && (
            <button className="text-button" onClick={onAdminMode}>
              Admin tools
            </button>
          )}
          {canViewReports && (
            <button className="text-button" onClick={onReportsMode}>
              Incident history
            </button>
          )}
          <button className="text-button" onClick={onChangeEvent}>
            Switch event
          </button>
          <button
            className="text-button"
            onClick={async () => {
              await api.checkOut(event.id);
              onChangeEvent();
            }}
          >
            Check out
          </button>
          <button className="text-button" onClick={onLogOut}>
            Log out
          </button>
        </div>
      </div>

      <div className="main-columns">
        <div className="column">
          <div className="column-header">
            <h2>Units</h2>
            <span className="column-count">{units?.length ?? 0}</span>
          </div>
          <p className="drag-hint">Drag an available unit onto an incident to assign it.</p>
          <div className="column-body">
            {units === null && <p className="empty-state">Loading…</p>}
            {units?.length === 0 && <p className="empty-state">No units set up for this event yet.</p>}
            {units?.map((unit) => {
              const assignment = assignmentByUnitId.get(unit.id);
              const assignedIncident = assignment ? incidentById.get(assignment.incident_id) : null;
              return (
                <UnitRow
                  key={unit.id}
                  unit={unit}
                  assignedIncident={assignedIncident}
                  onDragStart={handleUnitDragStart}
                  onClick={() => setSelectedUnitId(unit.id)}
                />
              );
            })}
          </div>
        </div>

        <div className="column">
          <div className="column-header">
            <h2>Incidents</h2>
            <span className="column-count">{sortedIncidents.length}</span>
          </div>
          <div className="column-body">
            <button className="new-incident-button" onClick={() => setCreatingIncident(true)}>
              + New incident
            </button>
            {dropError && (
              <p className="error-text" style={{ marginBottom: 8 }}>
                {dropError}
              </p>
            )}
            {incidents === null && <p className="empty-state">Loading…</p>}
            {incidents !== null && sortedIncidents.length === 0 && (
              <p className="empty-state">No open incidents.</p>
            )}
            {sortedIncidents.map((incident) => {
              const assignment = assignmentByIncidentId.get(incident.id);
              const assignedUnit = assignment ? unitById.get(assignment.unit_id) : null;
              return (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  zoneLabel={incident.zone_label}
                  assignedUnitLabel={assignedUnit?.label}
                  assignmentStatus={assignment?.status}
                  onClick={() => setSelectedIncidentId(incident.id)}
                  onDropUnit={(unitId) => handleDropUnit(unitId, incident.id)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {selectedUnit && (
        <UnitDetailPanel
          unit={selectedUnit}
          assignment={assignmentByUnitId.get(selectedUnit.id)}
          eventId={event.id}
          onClose={() => setSelectedUnitId(null)}
          onChanged={refreshAll}
        />
      )}

      {selectedIncident && (
        <IncidentDetailPanel
          incident={selectedIncident}
          eventId={event.id}
          zoneLabel={selectedIncident.zone_label}
          units={units ?? []}
          assignment={selectedAssignment}
          onClose={() => setSelectedIncidentId(null)}
          onChanged={refreshAll}
        />
      )}

      {creatingIncident && (
        <NewIncidentPanel
          eventId={event.id}
          zones={zones ?? []}
          onClose={() => setCreatingIncident(false)}
          onCreated={() => {
            setCreatingIncident(false);
            refreshIncidents();
          }}
        />
      )}
    </div>
  );
}
