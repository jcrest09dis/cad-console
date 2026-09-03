import { useState } from 'react';
import { incidentRowClass, incidentBadgeClass } from '../statusStyles.js';

export const DRAG_MIME = 'application/x-cad-unit-id';

export default function IncidentRow({ incident, zoneLabel, assignedUnitLabel, assignmentStatus, onClick, onDropUnit }) {
  const [dragOver, setDragOver] = useState(false);
  // Only an unassigned incident can accept a dropped unit - matches the
  // existing rule (IncidentDetailPanel only shows the assign UI when
  // there's no current assignment); the backend's partial unique index
  // would reject a second assignment anyway, this just avoids ever
  // attempting it.
  const canAcceptDrop = !assignedUnitLabel;

  function handleDragOver(e) {
    if (!canAcceptDrop) return; // no preventDefault -> browser shows its own "not allowed" cursor
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    setDragOver(true);
  }

  function handleDrop(e) {
    if (!canAcceptDrop) return;
    const unitId = e.dataTransfer.getData(DRAG_MIME);
    setDragOver(false);
    if (unitId) onDropUnit?.(unitId);
  }

  return (
    <div
      className={`row clickable ${incidentRowClass(incident.priority, assignmentStatus)} ${dragOver ? 'row-drop-target' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="row-main">
        <div className="row-title">{zoneLabel ?? 'Unknown zone'}</div>
        <div className="row-sub">
          {incident.type}
          {assignedUnitLabel ? ` — assigned to ${assignedUnitLabel}` : ' — unassigned'}
        </div>
      </div>
      <span className={incidentBadgeClass(incident.priority)}>{incident.priority}</span>
    </div>
  );
}
