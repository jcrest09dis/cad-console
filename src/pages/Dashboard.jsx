import { useState, useEffect } from 'react';
import { api } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import { useLiveSocket } from '../hooks/useLiveSocket.js';
import UnitRow from '../components/UnitRow.jsx';
import IncidentRow, { DRAG_MIME } from '../components/IncidentRow.jsx';
import UnitDetailPanel from '../components/UnitDetailPanel.jsx';
import IncidentDetailPanel from '../components/IncidentDetailPanel.jsx';
import NewIncidentPanel from '../components/NewIncidentPanel.jsx';
import VenueMapView from '../components/VenueMapView.jsx';

const UNIT_TYPE_OPTIONS = ['EC', 'Cart', 'Rupp Cart', 'Law', 'Fire', 'Unspecified'];
const UNIT_TYPE_TABS_STORAGE_KEY = 'cad-console:unit-type-tabs';
const DEFAULT_UNIT_TYPE_TAB = { id: 'all', name: 'All units', types: null };

export default function Dashboard({ event, staffName, isAdmin, canViewReports, onAdminMode, onReportsMode, onChangeEvent, onLogOut }) {
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [creatingIncident, setCreatingIncident] = useState(false);
  const [dropError, setDropError] = useState(null);
  const [view, setView] = useState('board'); // 'board' | 'map'
  const [unitStatusFilter, setUnitStatusFilter] = useState('all'); // 'all' | 'available' | 'assigned'

  // Named, savable groupings of unit types (e.g. "Medical" = EC + Cart),
  // persisted in this browser so a dispatcher's custom tabs survive reloads.
  // The built-in "All units" tab (types: null) can't be removed.
  const [unitTypeTabs, setUnitTypeTabs] = useState(() => {
    try {
      const saved = localStorage.getItem(UNIT_TYPE_TABS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {
      // Storage unavailable or corrupt - fall back to the default tab.
    }
    return [DEFAULT_UNIT_TYPE_TAB];
  });
  const [activeUnitTypeTabId, setActiveUnitTypeTabId] = useState('all');
  const [addingUnitTypeTab, setAddingUnitTypeTab] = useState(false);
  const [newTabName, setNewTabName] = useState('');
  const [newTabTypes, setNewTabTypes] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(UNIT_TYPE_TABS_STORAGE_KEY, JSON.stringify(unitTypeTabs));
    } catch {
      // Storage unavailable or full - tabs just won't persist this session.
    }
  }, [unitTypeTabs]);

  function toggleNewTabType(type) {
    setNewTabTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function handleSaveUnitTypeTab(e) {
    e.preventDefault();
    if (!newTabName.trim() || newTabTypes.length === 0) return;
    const tab = { id: `tab-${Date.now()}`, name: newTabName.trim(), types: newTabTypes };
    setUnitTypeTabs((prev) => [...prev, tab]);
    setActiveUnitTypeTabId(tab.id);
    setNewTabName('');
    setNewTabTypes([]);
    setAddingUnitTypeTab(false);
  }

  function handleDeleteUnitTypeTab(tabId) {
    if (tabId === 'all') return;
    setUnitTypeTabs((prev) => prev.filter((t) => t.id !== tabId));
    if (activeUnitTypeTabId === tabId) setActiveUnitTypeTabId('all');
  }

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

  async function handleCloseEvent() {
    if (
      !window.confirm(
        `Close "${event.name}"? Any units still assigned to it will be returned to the pool ` +
        '(unassigned) with their crew cleared, any of their active assignments will be cancelled, ' +
        'and everyone still checked in will be checked out. An admin can reopen it later, but units ' +
        'and staff will need to be reassigned/checked in manually.'
      )
    ) {
      return;
    }
    try {
      await api.closeEvent(event.id);
      onChangeEvent();
    } catch (err) {
      setDropError(err.message);
    }
  }

  const unitById = new Map((units ?? []).map((u) => [u.id, u]));
  const incidentById = new Map((incidents ?? []).map((i) => [i.id, i]));
  const assignmentByIncidentId = new Map((assignments ?? []).map((a) => [a.incident_id, a]));
  const assignmentByUnitId = new Map((assignments ?? []).map((a) => [a.unit_id, a]));

  // Units are grouped by type on the board (EC / Cart / Law / Fire, with an
  // "Unspecified" bucket for units an admin hasn't typed yet). The active
  // unit-type tab narrows which types are visible at all, the status filter
  // narrows by assignment state, and within each group assigned/active units
  // sort above available ones (then alphabetically by label).
  const UNIT_TYPE_ORDER = ['EC', 'Cart', 'Rupp Cart', 'Law', 'Fire'];
  const activeUnitTypeTab = unitTypeTabs.find((t) => t.id === activeUnitTypeTabId) ?? unitTypeTabs[0];
  const filteredUnits = (units ?? []).filter((u) => {
    if (activeUnitTypeTab.types) {
      const key = u.unit_type || 'Unspecified';
      if (!activeUnitTypeTab.types.includes(key)) return false;
    }
    if (unitStatusFilter === 'all') return true;
    const isAssigned = assignmentByUnitId.has(u.id);
    return unitStatusFilter === 'assigned' ? isAssigned : !isAssigned;
  });
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    const aRank = a.unit_type ? UNIT_TYPE_ORDER.indexOf(a.unit_type) : UNIT_TYPE_ORDER.length;
    const bRank = b.unit_type ? UNIT_TYPE_ORDER.indexOf(b.unit_type) : UNIT_TYPE_ORDER.length;
    if (aRank !== bRank) return aRank - bRank;
    const aAssigned = assignmentByUnitId.has(a.id) ? 0 : 1;
    const bAssigned = assignmentByUnitId.has(b.id) ? 0 : 1;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;
    return a.label.localeCompare(b.label);
  });
  const unitGroups = sortedUnits.reduce((acc, u) => {
    const key = u.unit_type || 'Unspecified';
    (acc[key] ??= []).push(u);
    return acc;
  }, {});
  const unitGroupOrder = [...UNIT_TYPE_ORDER, 'Unspecified'].filter((key) => unitGroups[key]?.length);

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

      <div className="admin-tabs">
        <button className={`admin-tab ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>
          Board
        </button>
        <button className={`admin-tab ${view === 'map' ? 'active' : ''}`} onClick={() => setView('map')}>
          Venue map
        </button>
      </div>

      {view === 'map' && <VenueMapView event={event} onSelectIncident={setSelectedIncidentId} />}

      {view === 'board' && (
        <div className="main-columns">
          <div className="column">
            <div className="column-header">
              <h2>Units</h2>
              <span className="column-count">{sortedUnits.length}</span>
            </div>
            <p className="drag-hint">Drag an available unit onto an incident to assign it.</p>
            <div className="admin-tabs" style={{ margin: '4px 0 8px', flexWrap: 'wrap' }}>
              {unitTypeTabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`admin-tab ${activeUnitTypeTabId === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveUnitTypeTabId(tab.id)}
                  title={tab.types ? tab.types.join(', ') : 'All unit types'}
                >
                  {tab.name}
                  {tab.id !== 'all' && (
                    <span
                      role="button"
                      aria-label={`Delete ${tab.name} tab`}
                      style={{ marginLeft: 6, opacity: 0.6 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteUnitTypeTab(tab.id);
                      }}
                    >
                      x
                    </span>
                  )}
                </button>
              ))}
              <button className="admin-tab" onClick={() => setAddingUnitTypeTab((v) => !v)}>
                + Tab
              </button>
            </div>

            {addingUnitTypeTab && (
              <form className="admin-form-row" onSubmit={handleSaveUnitTypeTab} style={{ marginBottom: 8 }}>
                <div className="admin-form-field">
                  <label>Tab name</label>
                  <input
                    className="field-input"
                    value={newTabName}
                    onChange={(e) => setNewTabName(e.target.value)}
                    placeholder="e.g. Medical"
                  />
                </div>
                <div className="admin-form-field">
                  <label>Unit types</label>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {UNIT_TYPE_OPTIONS.map((type) => (
                      <label key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <input
                          type="checkbox"
                          checked={newTabTypes.includes(type)}
                          onChange={() => toggleNewTabType(type)}
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </div>
                <button className="button button-primary" type="submit">
                  Save tab
                </button>
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    setAddingUnitTypeTab(false);
                    setNewTabName('');
                    setNewTabTypes([]);
                  }}
                >
                  Cancel
                </button>
              </form>
            )}

            <div className="admin-form-field" style={{ padding: '0 0 8px' }}>
              <label>Show</label>
              <select
                className="field-select"
                value={unitStatusFilter}
                onChange={(e) => setUnitStatusFilter(e.target.value)}
              >
                <option value="all">All units</option>
                <option value="available">Available only</option>
                <option value="assigned">Assigned only</option>
              </select>
            </div>
            <div className="column-body">
              {units === null && <p className="empty-state">Loading…</p>}
              {units?.length === 0 && <p className="empty-state">No units set up for this event yet.</p>}
              {units?.length > 0 && sortedUnits.length === 0 && (
                <p className="empty-state">No units match this filter.</p>
              )}
              {unitGroupOrder.map((type) => (
                <div key={type}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      opacity: 0.65,
                      textTransform: 'uppercase',
                      margin: '8px 0 4px',
                    }}
                  >
                    {type} ({unitGroups[type].length})
                  </p>
                  {unitGroups[type].map((unit) => {
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
              ))}
            </div>
          </div>

          <div className="column">
            <div className="column-header">
              <h2>Incidents</h2>
              <span className="column-count">{sortedIncidents.length}</span>
            </div>
            <div className="column-body">
              <button className="button button-danger" style={{ width: '100%', marginBottom: 8 }} onClick={handleCloseEvent}>
                Close event
              </button>
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
      )}

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