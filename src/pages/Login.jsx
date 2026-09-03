import { useState } from 'react';
import { api, setAuthToken } from '../api.js';

export default function Login({ onLoggedIn }) {
  const [username, setUsername] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { token } = await api.login(username.trim(), totpCode.trim());
      setAuthToken(token);
      onLoggedIn();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <p className="login-title">Dispatch console</p>
        <p className="login-sub">Sign in with your username and authenticator code.</p>

        <div className="field-group">
          <label className="field-label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="totp">
            6-digit code
          </label>
          <input
            id="totp"
            className="field-input mono"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            autoComplete="one-time-code"
          />
        </div>

        <button className="button button-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        {error && <p className="error-text">{error}</p>}
      </form>
    </div>
  );
}
