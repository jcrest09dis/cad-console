import { useEffect, useState } from 'react';
import { adminApi } from '../adminApi.js';
import { fetchVenueMapImageBlob } from '../api.js';

export default function AdminVenuesTab({ venues, onRefresh }) {
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [expandedVenueId, setExpandedVenueId] = useState(null);
  const [expandedMapVenueId, setExpandedMapVenueId] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await adminApi.createVenue({ name: name.trim() });
      setName('');
      onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      <p className="admin-section-title">Add venue</p>
      <form className="admin-form-row" onSubmit={handleCreate}>
        <div className="admin-form-field">
          <label>Name</label>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <button className="button button-primary" type="submit" disabled={busy}>
          Add
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      <p className="admin-section-title">Venues ({venues?.length ?? 0})</p>
      {venues?.map((venue) => (
        <div key={venue.id}>
          <div className="admin-list-row">
            <div className="admin-list-row-main">
              {venue.name}
              {venue.has_map && (
                <span className="admin-list-row-sub" style={{ marginLeft: 8 }}>
                  (map uploaded)
                </span>
              )}
            </div>
            <button
              className="button"
              onClick={() => setExpandedVenueId(expandedVenueId === venue.id ? null : venue.id)}
            >
              {expandedVenueId === venue.id ? 'Hide zones' : 'Manage zones'}
            </button>
            <button
              className="button"
              onClick={() => setExpandedMapVenueId(expandedMapVenueId === venue.id ? null : venue.id)}
            >
              {expandedMapVenueId === venue.id ? 'Hide map' : 'Manage map'}
            </button>
          </div>
          {expandedVenueId === venue.id && <ZoneManager venueId={venue.id} />}
          {expandedMapVenueId === venue.id && (
            <VenueMapManager venueId={venue.id} hasMap={venue.has_map} onVenueChanged={onRefresh} />
          )}
        </div>
      ))}
    </div>
  );
}

function ZoneManager({ venueId }) {
  const [zones, setZones] = useState(null);
  const [label, setLabel] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [editingZoneId, setEditingZoneId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function load() {
    adminApi.listZones(venueId).then(setZones).catch((err) => setError(err.message));
  }

  useEffect(load, [venueId]);

  async function handleAdd(e) {
    e.preventDefault();
    if (!label.trim()) return;
    try {
      await adminApi.createZone(venueId, { label: label.trim() });
      setLabel('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Bulk import: one zone label per line - built for populating a whole
  // venue at once (a stadium map's worth of sections/suites/named areas)
  // rather than the single-zone form above, one at a time, dozens of
  // times in a row.
  async function handleBulkImport() {
    const labels = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (labels.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      await adminApi.batchCreateZones(venueId, labels);
      setBulkText('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Wholesale replace - for re-importing a corrected/updated list (e.g.
  // adding row ranges to labels that already existed) without ending up
  // with both old and new versions as duplicate suggestions.
  async function handleReplaceAll() {
    const labels = bulkText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (labels.length === 0) return;
    if (!window.confirm(`Delete all ${zones?.length ?? 0} existing zones and replace with these ${labels.length}?`)) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await adminApi.replaceZones(venueId, labels);
      setBulkText('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveZoneEdit(zoneId) {
    if (!editDraft.trim()) return;
    setError(null);
    try {
      await adminApi.updateZone(zoneId, editDraft.trim());
      setEditingZoneId(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteZone(zone) {
    if (!window.confirm(`Delete zone "${zone.label}"?`)) return;
    setError(null);
    try {
      await adminApi.deleteZone(zone.id);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-drilldown">
      <form className="admin-form-row" onSubmit={handleAdd}>
        <div className="admin-form-field">
          <label>Zone label (e.g. Section 114, Gate C)</label>
          <input className="field-input" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button className="button" type="submit">
          Add zone
        </button>
      </form>

      <div className="admin-form-field" style={{ marginTop: 12, marginBottom: 12 }}>
        <label>Bulk import (one zone per line)</label>
        <textarea
          className="field-input"
          style={{ minHeight: 100, fontFamily: 'monospace', fontSize: 13 }}
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={'Section 1\nSection 2\nWildcat Plaza\n...'}
        />
        <button
          className="button button-primary"
          style={{ marginTop: 6 }}
          onClick={handleBulkImport}
          disabled={busy || !bulkText.trim()}
        >
          {busy ? 'Importing…' : `Import ${bulkText.split('\n').map((l) => l.trim()).filter(Boolean).length} zones`}
        </button>
        <button
          className="button button-danger"
          style={{ marginTop: 6, marginLeft: 8 }}
          onClick={handleReplaceAll}
          disabled={busy || !bulkText.trim()}
        >
          Replace ALL zones with this list
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}
      {zones?.length === 0 && <p className="empty-state">No zones yet.</p>}
      {zones?.map((zone) => (
        <div className="admin-list-row" key={zone.id}>
          {editingZoneId === zone.id ? (
            <>
              <input
                className="field-input"
                style={{ flex: 1 }}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveZoneEdit(zone.id);
                  if (e.key === 'Escape') setEditingZoneId(null);
                }}
              />
              <button className="button button-primary" onClick={() => handleSaveZoneEdit(zone.id)}>
                Save
              </button>
              <button className="button" onClick={() => setEditingZoneId(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <div className="admin-list-row-main">{zone.label}</div>
              <button
                className="button"
                onClick={() => {
                  setEditDraft(zone.label);
                  setEditingZoneId(zone.id);
                }}
              >
                Edit
              </button>
              <button className="button button-danger" onClick={() => handleDeleteZone(zone)}>
                Delete
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// Upload/replace a venue's map image and click-to-place each zone's
// position on it. Coordinates are saved as fractional (0-1) x/y - see
// backend migration 009_venue_maps.sql - so placement stays correct
// regardless of how large the image renders on any given screen.
function VenueMapManager({ venueId, hasMap, onVenueChanged }) {
  const [zones, setZones] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  function loadZones() {
    adminApi.listZones(venueId).then(setZones).catch((err) => setError(err.message));
  }

  useEffect(loadZones, [venueId]);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    if (hasMap) {
      setImageError(null);
      fetchVenueMapImageBlob(venueId)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        })
        .catch((err) => !cancelled && setImageError(err.message));
    } else {
      setImageUrl(null);
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [venueId, hasMap]);

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const imageBase64 = await fileToBase64(file);
      await adminApi.uploadVenueMap(venueId, { imageBase64, contentType: file.type || 'image/png' });
      onVenueChanged();
      // onVenueChanged() reloads the venues list asynchronously, so
      // hasMap won't flip on this render yet - fetch the fresh image
      // directly here too rather than waiting on a prop update.
      const blob = await fetchVenueMapImageBlob(venueId);
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  }

  async function handleRemoveMap() {
    if (!window.confirm("Remove this venue's map image? Every zone's placed position will also be cleared.")) return;
    setError(null);
    setBusy(true);
    try {
      await adminApi.deleteVenueMap(venueId);
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      onVenueChanged();
      loadZones();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImageClick(e) {
    if (!selectedZoneId) {
      setError('Select a zone below first, then click its spot on the map.');
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const mapX = (e.clientX - rect.left) / rect.width;
    const mapY = (e.clientY - rect.top) / rect.height;
    setError(null);
    try {
      await adminApi.saveZoneMapPosition(selectedZoneId, mapX, mapY);
      loadZones();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleClearPosition(zoneId) {
    setError(null);
    try {
      await adminApi.saveZoneMapPosition(zoneId, null, null);
      loadZones();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="admin-drilldown">
      <div className="admin-form-field" style={{ marginBottom: 12 }}>
        <label>{hasMap ? 'Replace map image' : 'Upload map image'}</label>
        <input type="file" accept="image/*" onChange={handleFileSelected} disabled={busy} />
      </div>

      {imageError && <p className="error-text">{imageError}</p>}
      {error && <p className="error-text">{error}</p>}

      {imageUrl && (
        <>
          <p className="admin-list-row-sub" style={{ marginBottom: 8 }}>
            Select a zone below, then click its location on the map to place it.
          </p>
          <div className="venue-map-admin-wrap" onClick={handleImageClick}>
            <img src={imageUrl} alt="Venue map" className="venue-map-admin-image" />
            {zones
              ?.filter((z) => z.map_x != null && z.map_y != null)
              .map((z) => (
                <button
                  key={z.id}
                  type="button"
                  className={`venue-map-admin-pin ${selectedZoneId === z.id ? 'selected' : ''}`}
                  style={{ left: `${z.map_x * 100}%`, top: `${z.map_y * 100}%` }}
                  title={z.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedZoneId(z.id);
                  }}
                />
              ))}
          </div>

          <div className="admin-form-field" style={{ marginTop: 12, marginBottom: 12 }}>
            <label>Zone to place</label>
            <select
              className="field-select"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(e.target.value)}
            >
              <option value="">— select a zone —</option>
              {zones?.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label} {z.map_x != null ? '(placed)' : ''}
                </option>
              ))}
            </select>
          </div>

          <p className="admin-list-row-sub" style={{ marginBottom: 6 }}>
            Placed zones
          </p>
          {zones?.filter((z) => z.map_x != null).length === 0 && (
            <p className="empty-state" style={{ padding: '8px 0' }}>
              No zones placed on the map yet.
            </p>
          )}
          {zones
            ?.filter((z) => z.map_x != null)
            .map((z) => (
              <div className="admin-list-row" key={z.id}>
                <div className="admin-list-row-main">{z.label}</div>
                <button className="button button-danger" onClick={() => handleClearPosition(z.id)}>
                  Clear position
                </button>
              </div>
            ))}

          <button className="button button-danger" style={{ marginTop: 12 }} onClick={handleRemoveMap} disabled={busy}>
            Remove map image
          </button>
        </>
      )}

      {!imageUrl && !imageError && hasMap && <p className="empty-state">Loading map…</p>}
    </div>
  );
}