import { useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';

export default function AdminVenuesTab({ venues, onRefresh }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedVenueId, setExpandedVenueId] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await adminApi.createVenue({ name: name.trim() });
      setName('');
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      <p className="admin-section-title">Add venue</p>
      <form className="admin-form-row" onSubmit={handleCreate}>
        <div className="admin-form-field">
          <label>Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="button button-primary" type="submit" disabled={busy}>
          Add
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <p className="admin-section-title">Venues ({venues?.length ?? 0})</p>
      {venues?.map((venue) => (
        <div key={venue.id}>
          <div className="admin-list-row">
            <div className="admin-list-row-main">{venue.name}</div>
            <button
              className="button"
              onClick={() => setExpandedVenueId(expandedVenueId === venue.id ? null : venue.id)}
            >
              {expandedVenueId === venue.id ? 'Hide zones' : 'Manage zones'}
            </button>
          </div>
          {expandedVenueId === venue.id && <ZoneManager venueId={venue.id} />}
        </div>
      ))}
    </div>
  );
}

function ZoneManager({ venueId }) {
  const [zones, setZones] = useState(null);
  const [label, setLabel] = useState('');
  const [error, setError] = useState(null);

  function load() {
    adminApi.listZones(venueId).then(setZones).catch((err) => setError(err.message));
  }

  useEffect(load, [venueId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await adminApi.createZone(venueId, { label: label.trim() });
      setLabel('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-drilldown">
      <form className="admin-form-row" onSubmit={handleAdd}>
        <div className="admin-form-field">
          <label>Zone label (e.g. Section 114, Gate C)</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button className="button" type="submit">
          Add zone
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}
      {zones?.length === 0 && <p className="empty-state">No zones yet.</p>}
      {zones?.map((zone) => (
        <div className="admin-list-row" key={zone.id}>
          <div className="admin-list-row-main">{zone.label}</div>
        </div>
      ))}
    </div>
  );
}
