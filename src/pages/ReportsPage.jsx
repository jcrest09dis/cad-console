import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { incidentBadgeClass } from '../statusStyles.js';

function formatDuration(createdAt, closedAt) {
  if (!closedAt) return null;
  const ms = new Date(closedAt) - new Date(createdAt);
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default function ReportsPage({ onExit }) {
  const [events, setEvents] = useState(null);
  const [filters, setFilters] = useState({ eventId: '', type: '', priority: '', status: '' });
  const [incidents, setIncidents] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    api.reportEvents().then(setEvents).catch((err) => setError(err.message));
  }, []);

  function runSearch() {
    setError(null);
    api.reportIncidents(filters).then(setIncidents).catch((err) => setError(err.message));
  }

  useEffect(runSearch, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">CAD Console</span>
          <span className="topbar-event">Incident history</span>
        </div>
        <div className="topbar-right">
          <button className="text-button" onClick={onExit}>
            Back
          </button>
        </div>
      </div>

      <div className="admin-body" style={{ maxWidth: 900 }}>
        <div className="admin-form-row">
          <div className="admin-form-field">
            <label>Event</label>
            <select
              className="field-select"
              value={filters.eventId}
              onChange={(e) => setFilters({ ...filters, eventId: e.target.value })}
            >
              <option value="">All events</option>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name} ({ev.venue_name})
                </option>
              ))}
            </select>
          </div>
          <div className="admin-form-field">
            <label>Type</label>
            <select
              className="field-select"
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            >
              <option value="">Any</option>
              <option value="medical">Medical</option>
              <option value="trauma">Trauma</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="admin-form-field">
            <label>Priority</label>
            <select
              className="field-select"
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            >
              <option value="">Any</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div className="admin-form-field">
            <label>Status</label>
            <select
              className="field-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Any</option>
              <option value="OPEN">Open</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <button className="button button-primary" onClick={runSearch}>
            Search
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}

        <p className="admin-section-title">{incidents?.length ?? 0} incidents</p>
        {incidents?.length === 0 && <p className="empty-state">No incidents match these filters.</p>}
        {incidents?.map((incident) => (
          <div
            key={incident.id}
            className="row clickable"
            style={{ marginBottom: 4 }}
            onClick={() => setSelectedId(incident.id)}
          >
            <div className="row-main">
              <div className="row-title">
                {incident.zone_label} — {incident.event_name}
              </div>
              <div className="row-sub">
                {incident.type}, {new Date(incident.created_at).toLocaleString()}
                {incident.unit_labels ? ` — ${incident.unit_labels.join(', ')}` : ''}
                {formatDuration(incident.created_at, incident.closed_at)
                  ? ` — ${formatDuration(incident.created_at, incident.closed_at)}`
                  : ''}
              </div>
            </div>
            <span className={incidentBadgeClass(incident.priority)}>{incident.priority}</span>
            <span className="badge" style={{ marginLeft: 6 }}>
              {incident.status.toLowerCase()}
            </span>
          </div>
        ))}
      </div>

      {selectedId && <ReportDetailPanel incidentId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function ReportDetailPanel({ incidentId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.reportIncidentDetail(incidentId).then(setDetail).catch((err) => setError(err.message));
  }, [incidentId]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="side-panel-header">
          <div>
            <p className="side-panel-title">{detail?.zone_label ?? 'Loading…'}</p>
            {detail && (
              <p className="login-sub" style={{ margin: 0 }}>
                {detail.event_name} — {detail.type}, {detail.priority} priority, {detail.status.toLowerCase()}
              </p>
            )}
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}
        {!detail && !error && <p className="empty-state">Loading…</p>}

        {detail && (
          <>
            <div className="panel-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
              <p className="panel-section-title">Timeline</p>
              <p className="row-sub">Created by {detail.created_by_name} at {new Date(detail.created_at).toLocaleString()}</p>
              {detail.closed_at && (
                <p className="row-sub">Closed at {new Date(detail.closed_at).toLocaleString()}</p>
              )}
            </div>

            <div className="panel-section">
              <p className="panel-section-title">Assignments</p>
              {detail.assignments.length === 0 && <p className="empty-state">No unit was ever assigned.</p>}
              {detail.assignments.map((a) => (
                <div key={a.id} className="admin-list-row">
                  <div className="admin-list-row-main">
                    <div>{a.unit_label}</div>
                    <div className="admin-list-row-sub">
                      {a.status.toLowerCase()}, dispatched by {a.dispatcher_name} at{' '}
                      {new Date(a.created_at).toLocaleString()}
                      {a.acked_at && `, acked at ${new Date(a.acked_at).toLocaleString()}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel-section">
              <p className="panel-section-title">Note history</p>
              {detail.noteRevisions.length === 0 && <p className="empty-state">No notes were added.</p>}
              {detail.noteRevisions.map((rev) => (
                <div key={rev.id} style={{ marginBottom: 10 }}>
                  <div className="row-sub">
                    {rev.authorName}, {new Date(rev.createdAt).toLocaleString()}
                  </div>
                  <div className="notes-content">{rev.content}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
