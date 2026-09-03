import { useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';

export default function AdminUnitsTab({ events, staff }) {
  const [units, setUnits] = useState(null);
  const [unitLabel, setUnitLabel] = useState('');
  const [expandedUnitId, setExpandedUnitId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function loadUnits() {
    adminApi.listAllUnits().then(setUnits).catch((err) => setError(err.message));
  }

  useEffect(loadUnits, []);

  async function handleAddUnit(e) {
    e.preventDefault();
    if (!unitLabel.trim()) return;
    setError(null);
    setBusy(true);
    try {
      // No event required - units are pooled now, the same way staff
      // are created once and assigned to events later rather than
      // recreated per event.
      await adminApi.createPooledUnit({ label: unitLabel.trim() });
      setUnitLabel('');
      loadUnits();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssignEvent(unitId, eventId) {
    setError(null);
    try {
      await adminApi.assignUnitEvent(unitId, eventId || null);
      loadUnits();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-section">
      <p className="admin-section-title">Add unit</p>
      <form className="admin-form-row" onSubmit={handleAddUnit}>
        <div className="admin-form-field">
          <label>Unit label (e.g. Medic 1)</label>
          <input className="field-input" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} />
        </div>
        <button className="button button-primary" type="submit" disabled={busy}>
          Add unit
        </button>
      </form>
      <p className="empty-state" style={{ padding: '0 0 12px' }}>
        New units start unassigned - use "Assign to event" below to put one to work.
      </p>
      {error && <p className="error-text">{error}</p>}

      <p className="admin-section-title">Units ({units?.length ?? 0})</p>
      {units?.length === 0 && <p className="empty-state">No units yet.</p>}
      {units?.map((unit) => (
        <div key={unit.id}>
          <div className="admin-list-row">
            <div className="admin-list-row-main">
              {unit.label}
              <span className="admin-list-row-sub">
                {' '}
                — {unit.event_name ? `${unit.event_name} (${unit.event_status})` : 'Unassigned'},{' '}
                {unit.status.toLowerCase()}
              </span>
            </div>
            <select
              className="field-select"
              style={{ maxWidth: 180 }}
              value={unit.event_id ?? ''}
              onChange={(e) => handleAssignEvent(unit.id, e.target.value)}
            >
              <option value="">Unassigned</option>
              {events?.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
            <button
              className="button"
              onClick={() => setExpandedUnitId(expandedUnitId === unit.id ? null : unit.id)}
            >
              {expandedUnitId === unit.id ? 'Hide crew' : 'Manage crew'}
            </button>
          </div>
          {expandedUnitId === unit.id && <CrewManager unitId={unit.id} staff={staff} />}
        </div>
      ))}
    </div>
  );
}

export function CrewManager({ unitId, staff }) {
  const [crew, setCrew] = useState(null);
  const [addStaffId, setAddStaffId] = useState('');
  const [error, setError] = useState(null);

  function load() {
    adminApi.listCrew(unitId).then(setCrew).catch((err) => setError(err.message));
  }
  useEffect(load, [unitId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!addStaffId) return;
    try {
      await adminApi.addCrew(unitId, addStaffId);
      setAddStaffId('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(staffId) {
    await adminApi.removeCrew(unitId, staffId);
    load();
  }

  const crewIds = new Set((crew ?? []).map((c) => c.id));
  const candidates = (staff ?? []).filter((s) => !crewIds.has(s.id));

  return (
    <div className="admin-drilldown">
      {error && <p className="error-text">{error}</p>}
      {crew?.length === 0 && <p className="empty-state">No one crewing this unit yet.</p>}
      {crew?.map((person) => (
        <div className="admin-list-row" key={person.id}>
          <div className="admin-list-row-main">{person.name}</div>
          <button className="button button-danger" onClick={() => handleRemove(person.id)}>
            Remove
          </button>
        </div>
      ))}
      <form className="admin-form-row" onSubmit={handleAdd} style={{ marginTop: 8 }}>
        <div className="admin-form-field">
          <label>Add crew member</label>
          <select className="field-select" value={addStaffId} onChange={(e) => setAddStaffId(e.target.value)}>
            <option value="">Select…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}
