import { useState } from 'react';
import { api } from '../api.js';

// zones (if provided) populate a <datalist> so previously-used location
// names are suggested while typing - but the field is free text now,
// not a required dropdown, so any value can be entered.
export default function NewIncidentPanel({ eventId, zones, onClose, onCreated }) {
  const [locationText, setLocationText] = useState('');
  const [type, setType] = useState('medical');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!locationText.trim()) {
      setError('Enter a location.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.createIncident(eventId, { locationText: locationText.trim(), type, priority });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="side-panel" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="side-panel-header">
          <p className="side-panel-title">New incident</p>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="location">
            Location
          </label>
          <input
            id="location"
            className="field-input"
            list="zone-suggestions"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="e.g. Section 114, Gate C, West Concourse"
            autoFocus
          />
          {zones?.length > 0 && (
            <datalist id="zone-suggestions">
              {zones.map((z) => (
                <option key={z.id} value={z.label} />
              ))}
            </datalist>
          )}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="type">
            Type
          </label>
          <select id="type" className="field-select" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="medical">Medical</option>
            <option value="trauma">Trauma</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="priority">
            Priority
          </label>
          <select
            id="priority"
            className="field-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        <div className="action-row">
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create incident'}
          </button>
        </div>

        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
