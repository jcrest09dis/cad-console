const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('cad_token', token);
  } else {
    localStorage.removeItem('cad_token');
  }
}

export function getAuthToken() {
  return authToken;
}

export function loadStoredToken() {
  authToken = localStorage.getItem('cad_token');
  return authToken;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  // Content-Type only when there's an actual body - Fastify's JSON parser
  // rejects an empty body when this header claims JSON content, which is
  // exactly the 400 "Bad Request" this was producing on every no-body POST
  // (check-in, check-out, cancel/complete assignment, etc).
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message = data?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  login: (username, totpCode) => request('/auth/login', { method: 'POST', body: { username, totpCode } }),
  confirmEnrollment: (username, totpCode) =>
    request('/auth/enroll/confirm', { method: 'POST', body: { username, totpCode } }),
  me: () => request('/me'),
  myEvents: () => request('/me/events'),

  units: (eventId) => request(`/events/${eventId}/units`),
  setUnitStatus: (eventId, unitId, status) =>
    request(`/events/${eventId}/units/${unitId}/status`, { method: 'POST', body: { status } }),

  incidents: (eventId) => request(`/events/${eventId}/incidents`),
  createIncident: (eventId, body) => request(`/events/${eventId}/incidents`, { method: 'POST', body }),
  setIncidentStatus: (eventId, incidentId, status) =>
    request(`/events/${eventId}/incidents/${incidentId}/status`, { method: 'POST', body: { status } }),
  getNotes: (eventId, incidentId) => request(`/events/${eventId}/incidents/${incidentId}/notes`),
  addNote: (eventId, incidentId, content) =>
    request(`/events/${eventId}/incidents/${incidentId}/notes`, { method: 'POST', body: { content } }),
  zones: (eventId) => request(`/events/${eventId}/zones`),

  // Self-check-in
  activeEvents: () => request('/events'),
  checkIn: (eventId) => request(`/me/events/${eventId}/checkin`, { method: 'POST' }),
  checkOut: (eventId) => request(`/me/events/${eventId}/checkout`, { method: 'POST' }),

  assignments: (eventId) => request(`/events/${eventId}/assignments`),
  createAssignment: (eventId, incidentId, unitId) =>
    request(`/events/${eventId}/assignments`, { method: 'POST', body: { incidentId, unitId } }),
  cancelAssignment: (eventId, assignmentId) =>
    request(`/events/${eventId}/assignments/${assignmentId}/cancel`, { method: 'POST' }),
  completeAssignment: (eventId, assignmentId) =>
    request(`/events/${eventId}/assignments/${assignmentId}/complete`, { method: 'POST' }),

  // Reports / incident history
  reportIncidents: (filters = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const qs = params.toString();
    return request(`/reports/incidents${qs ? `?${qs}` : ''}`);
  },
  reportIncidentDetail: (incidentId) => request(`/reports/incidents/${incidentId}`),
  reportEvents: () => request('/reports/events'),
};
