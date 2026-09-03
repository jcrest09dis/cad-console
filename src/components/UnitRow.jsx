import { unitRowClass, unitBadgeClass, unitStatusLabel } from '../statusStyles.js';

export default function UnitRow({ unit, assignedIncident, onDragStart, onDragEnd, onClick }) {
  const draggable = unit.status === 'AVAILABLE';

  return (
    <div
      className={`row clickable ${unitRowClass(unit.status)}`}
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e, unit) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      style={draggable ? { cursor: 'grab' } : undefined}
      title={draggable ? 'Click to change status, or drag onto an incident to assign' : 'Click to change status'}
    >
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
}
