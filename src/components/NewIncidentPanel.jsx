import { useState } from 'react';
import { api } from '../api.js';

// zones (if provided) populate a <datalist> so previously-used location
// names are suggested while typing - but the field is free text now,
// not a required dropdown, so any value can be entered.
//
// Location is three stacked fields rather than one - section is the
// only required part (matches how an incident gets reported in
// practice: "Section 224" is immediately actionable, row/seat are
// refinements that may not be known yet). Combined into a single
// multi-line location_text on submit, so the backend needed no changes
// at all - it was always just free text.
export default function NewIncidentPanel({ eventId, zones, onClose, onCreated }) {
  const [section, setSection] = useState('');
  const [row, setRow] = useState('');
  const [seat, setSeat] = useState('');
  const [type, setType] = useState('medical');
  const [priority, setPriority] = useState('medium');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!section.trim()) {
      setError('Enter a section.');
      return;
    }
    setError(null);
    setBusy(true);
    const lines = [section.trim()];
    if (row.trim()) lines.push(`Row ${row.trim()}`);
    if (seat.trim()) lines.push(`Seat ${seat.trim()}`);
    try {
      await api.createIncident(eventId, { locationText: lines.join('\n'), type, priority });
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
          <label className="field-label" htmlFor="section">
            Section
          </label>
          <input
            id="section"
            className="field-input"
            list="zone-suggestions"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="e.g. Section 224 (Rows 2-30)"
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
          <label className="field-label" htmlFor="row">
            Row
          </label>
          <input
            id="row"
            className="field-input"
            value={row}
            onChange={(e) => setRow(e.target.value)}
            placeholder="e.g. 9"
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="seat">
            Seat
          </label>
          <input
            id="seat"
            className="field-input"
            value={seat}
            onChange={(e) => setSeat(e.target.value)}
            placeholder="e.g. 30"
          />
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
