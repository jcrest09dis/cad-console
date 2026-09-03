import { getAuthToken } from './api.js';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Admin endpoints now use the same JWT as everything else - there's no
// separate admin secret anymore. Access is gated server-side by the
// caller's staff.is_admin flag (see backend's requireGlobalAdmin), and
// client-side by only ever showing the "Admin tools" entry point to
// staff whose /me response has is_admin: true.
async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
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
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export const adminApi = {
  listStaff: () => request('/admin/staff'),
  createStaff: (body) => request('/admin/staff', { method: 'POST', body }),
  updateStaff: (staffId, body) => request(`/admin/staff/${staffId}`, { method: 'PATCH', body }),
  deleteStaff: (staffId) => request(`/admin/staff/${staffId}`, { method: 'DELETE' }),
  setAdmin: (staffId, isAdmin) => request(`/admin/staff/${staffId}/set-admin`, { method: 'POST', body: { isAdmin } }),
  enrollStaff: (staffId) => request('/auth/enroll', { method: 'POST', body: { staffId } }),

  listVenues: () => request('/admin/venues'),
  createVenue: (body) => request('/admin/venues', { method: 'POST', body }),

  listZones: (venueId) => request(`/admin/venues/${venueId}/zones`),
  createZone: (venueId, body) => request(`/admin/venues/${venueId}/zones`, { method: 'POST', body }),

  listEvents: () => request('/admin/events'),
  createEvent: (body) => request('/admin/events', { method: 'POST', body }),
  closeEvent: (eventId) => request(`/admin/events/${eventId}/close`, { method: 'POST' }),

  listUnits: (eventId) => request(`/admin/events/${eventId}/units`),
  listAllUnits: () => request('/admin/units'),
  createUnit: (eventId, body) => request(`/admin/events/${eventId}/units`, { method: 'POST', body }),
  createPooledUnit: (body) => request('/admin/units', { method: 'POST', body }),
  assignUnitEvent: (unitId, eventId) =>
    request(`/admin/units/${unitId}/assign-event`, { method: 'POST', body: { eventId } }),

  listCrew: (unitId) => request(`/admin/units/${unitId}/crew`),
  addCrew: (unitId, staffId) => request(`/admin/units/${unitId}/crew`, { method: 'POST', body: { staffId } }),
  removeCrew: (unitId, staffId) =>
    request(`/admin/units/${unitId}/crew/remove`, { method: 'POST', body: { staffId } }),

  listStaffing: (eventId) => request(`/admin/events/${eventId}/staffing`),
  setStaffing: (eventId, body) => request(`/admin/events/${eventId}/staffing`, { method: 'POST', body }),
  checkoutStaffing: (eventId, staffId) =>
    request(`/admin/events/${eventId}/staffing/${staffId}/checkout`, { method: 'POST' }),
};
