import { useState } from 'react';
import { adminApi } from '../adminApi.js';
import { api } from '../api.js';

export default function AdminStaffTab({ staff, onRefresh }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('EMT');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState(null); // { staffName, username, secret, provisioningUri }
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmStatus, setConfirmStatus] = useState(null); // null | 'confirming' | 'confirmed' | error string
  const [editingStaff, setEditingStaff] = useState(null); // the person object being edited, or null

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim() || !username.trim()) {
      setError('Name and username are required.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await adminApi.createStaff({ name: name.trim(), role, phone: phone.trim() || null, username: username.trim() });
      setName('');
      setPhone('');
      setUsername('');
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleEnroll(person) {
    setError(null);
    setConfirmCode('');
    setConfirmStatus(null);
    try {
      const result = await adminApi.enrollStaff(person.id);
      setEnrollment({ staffName: person.name, username: person.username, ...result });
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleConfirm() {
    setConfirmStatus('confirming');
    try {
      await api.confirmEnrollment(enrollment.username, confirmCode.trim());
      setConfirmStatus('confirmed');
    } catch (err) {
      setConfirmStatus(err.message);
    }
  }

  async function handleToggleActive(person) {
    setError(null);
    try {
      await adminApi.updateStaff(person.id, { active: !person.active });
      onRefresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(person) {
    setError(null);
    if (!window.confirm(`Permanently delete ${person.name}? This only works if they have no history.`)) {
      return;
    }
    try {
      await adminApi.deleteStaff(person.id);
      onRefresh();
    } catch (err) {
      // 409 from the backend means they have real history - deleting
      // would either fail on a foreign key or damage the audit trail,
      // so the backend refuses and suggests deactivating instead.
      setError(err.message.includes('history') ? `${err.message} (use Deactivate below instead)` : err.message);
    }
  }

  return (
    <div className="admin-section">
      <p className="admin-section-title">Add staff</p>
      <form className="admin-form-row" onSubmit={handleCreate}>
        <div className="admin-form-field">
          <label>Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="admin-form-field">
          <label>Role</label>
          <select className="field-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="EMT">EMT</option>
            <option value="paramedic">Paramedic</option>
            <option value="nurse">Nurse</option>
            <option value="dispatcher">Dispatcher</option>
          </select>
        </div>
        <div className="admin-form-field">
          <label>Username</label>
          <input className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="admin-form-field">
          <label>Phone (optional)</label>
          <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <button className="button button-primary" type="submit" disabled={busy}>
          Add
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <p className="admin-section-title">Staff ({staff?.length ?? 0})</p>
      {staff?.map((person) => (
        <div className="admin-list-row" key={person.id}>
          <div className="admin-list-row-main">
            <div>
              {person.name}
              {person.is_admin && <span className="badge badge-available" style={{ marginLeft: 8 }}>admin</span>}
              {!person.active && <span className="badge badge-out" style={{ marginLeft: 8 }}>inactive</span>}
            </div>
            <div className="admin-list-row-sub">
              {person.role}, username: {person.username ?? 'not set'}
            </div>
          </div>
          <button className="button" onClick={() => setEditingStaff(person)}>
            Edit
          </button>
          <button
            className="button"
            onClick={async () => {
              try {
                await adminApi.setAdmin(person.id, !person.is_admin);
                onRefresh();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            {person.is_admin ? 'Remove admin' : 'Make admin'}
          </button>
          <button className="button" onClick={() => handleEnroll(person)}>
            Enroll authenticator
          </button>
          <button className="button" onClick={() => handleToggleActive(person)}>
            {person.active ? 'Deactivate' : 'Reactivate'}
          </button>
          <button className="button button-danger" onClick={() => handleDelete(person)}>
            Delete
          </button>
        </div>
      ))}

      {editingStaff && (
        <EditStaffPanel
          person={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSaved={() => {
            setEditingStaff(null);
            onRefresh();
          }}
        />
      )}

      {enrollment && (
        <div className="overlay" onClick={() => setEnrollment(null)}>
          <div className="side-panel" onClick={(e) => e.stopPropagation()}>
            <div className="side-panel-header">
              <p className="side-panel-title">Enroll {enrollment.staffName}</p>
              <button className="close-button" onClick={() => setEnrollment(null)} aria-label="Close">
                ×
              </button>
            </div>
            <p className="login-sub">
              Have them add a new account in Google Authenticator, Authy, or similar, using
              manual entry with this secret:
            </p>
            <div className="notes-content mono">{enrollment.secret}</div>
            <p className="login-sub">Or the full provisioning URI (for a QR code generator):</p>
            <div className="notes-content mono" style={{ wordBreak: 'break-all' }}>
              {enrollment.provisioningUri}
            </div>
            <p className="login-sub">
              Once they've added it, have them read you the current 6-digit code to confirm
              the enrollment before login will work:
            </p>
            <div className="admin-form-row" style={{ marginBottom: 10 }}>
              <div className="admin-form-field">
                <label>6-digit code</label>
                <input
                  className="field-input mono"
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
              <button className="button button-primary" onClick={handleConfirm} disabled={confirmCode.length !== 6}>
                Confirm
              </button>
            </div>
            {confirmStatus === 'confirmed' && (
              <p style={{ color: 'var(--status-available)', fontSize: 13 }}>
                Confirmed — {enrollment.staffName} can now log in.
              </p>
            )}
            {confirmStatus && confirmStatus !== 'confirming' && confirmStatus !== 'confirmed' && (
              <p className="error-text">{confirmStatus}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditStaffPanel({ person, onClose, onSaved }) {
  const [name, setName] = useState(person.name);
  const [role, setRole] = useState(person.role);
  const [phone, setPhone] = useState(person.phone ?? '');
  const [username, setUsername] = useState(person.username ?? '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminApi.updateStaff(person.id, {
        name: name.trim(),
        role,
        phone: phone.trim() || null,
        username: username.trim(),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="side-panel" onClick={(e) => e.stopPropagation()} onSubmit={handleSave}>
        <div className="side-panel-header">
          <p className="side-panel-title">Edit {person.name}</p>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="field-group">
          <label className="field-label">Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">Role</label>
          <select className="field-select" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="EMT">EMT</option>
            <option value="paramedic">Paramedic</option>
            <option value="nurse">Nurse</option>
            <option value="dispatcher">Dispatcher</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="field-group">
          <label className="field-label">Username</label>
          <input className="field-input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="field-group">
          <label className="field-label">Phone</label>
          <input className="field-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="action-row">
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
