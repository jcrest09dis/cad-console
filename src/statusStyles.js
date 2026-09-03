// Central mapping from backend enum values to the row/badge color classes
// defined in styles.css. Keeping this in one place means a new status
// value only needs updating here, not hunted down across components.

export function unitRowClass(status) {
  if (status === 'AVAILABLE') return 'row-bar-available';
  if (status === 'OUT_OF_SERVICE') return 'row-bar-out';
  return 'row-bar-progress'; // ENROUTE / ON_SCENE / TRANSPORTING / AT_DESTINATION
}

export function unitBadgeClass(status) {
  if (status === 'AVAILABLE') return 'badge badge-available';
  if (status === 'OUT_OF_SERVICE') return 'badge badge-out';
  return 'badge badge-progress';
}

export function unitStatusLabel(status) {
  return status.replaceAll('_', ' ').toLowerCase();
}

// Incident row color is priority-driven normally, but an UNCONFIRMED
// assignment overrides everything - that's the "hand off to a human"
// signal from the escalation ladder and needs to be unmissable.
export function incidentRowClass(priority, assignmentStatus) {
  if (assignmentStatus === 'UNCONFIRMED') return 'row-bar-alert';
  if (priority === 'high') return 'row-bar-high';
  if (priority === 'medium') return 'row-bar-medium';
  return 'row-bar-low';
}

export function incidentBadgeClass(priority) {
  if (priority === 'high') return 'badge badge-high';
  if (priority === 'medium') return 'badge badge-medium';
  return 'badge badge-low';
}

export function assignmentBadgeClass(status) {
  if (status === 'UNCONFIRMED') return 'badge badge-alert';
  if (status === 'ACKED') return 'badge badge-available';
  if (status === 'ESCALATED_SMS') return 'badge badge-medium';
  return 'badge'; // PENDING
}

export function assignmentStatusLabel(status) {
  const labels = {
    PENDING: 'awaiting ack',
    ACKED: 'acknowledged',
    ESCALATED_SMS: 'escalated (SMS sent)',
    UNCONFIRMED: 'unconfirmed - needs attention',
  };
  return labels[status] ?? status.toLowerCase();
}
