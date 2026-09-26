import { useEffect, useState } from 'react';
import { api, fetchVenueMapImageBlob } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';

const PRIORITY_COLOR_VAR = {
  high: 'var(--priority-high)',
  medium: 'var(--priority-medium)',
  low: 'var(--priority-low)',
};

// Read-only companion to the admin click-to-place tool
// (AdminVenuesTab.jsx's VenueMapManager) - plots currently-open incidents
// as pins using positions the backend already matched via
// GET /events/:eventId/map (see venueMaps.js: matches the first line of
// an incident's free-text location against a placed zone's label).
export default function VenueMapView({ event, onSelectIncident }) {
  const { data: mapData } = usePolling(() => api.eventMap(event.id), [event.id], 15000);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(null);

  useEffect(() => {
    let objectUrl = null;
    let cancelled = false;
    if (mapData?.hasMapImage) {
      setImageError(null);
      fetchVenueMapImageBlob(mapData.venueId)
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
  }, [mapData?.venueId, mapData?.hasMapImage]);

  if (mapData === null) {
    return <p className="empty-state">Loading map…</p>;
  }
  if (!mapData.hasMapImage) {
    return (
      <p className="empty-state">
        No map has been uploaded for this venue yet. An admin can add one under Admin tools → Venues → Manage map.
      </p>
    );
  }
  if (imageError) {
    return <p className="error-text">{imageError}</p>;
  }

  const plottedIncidents = (mapData.incidents ?? []).filter((i) => i.mapX != null && i.mapY != null);
  const unplottedCount = (mapData.incidents ?? []).length - plottedIncidents.length;

  return (
    <div className="venue-map-view">
      {imageUrl && (
        <div className="venue-map-image-wrap">
          <img src={imageUrl} alt="Venue map" className="venue-map-image" />
          {plottedIncidents.map((incident) => (
            <button
              key={incident.id}
              type="button"
              className="venue-map-pin"
              style={{
                left: `${incident.mapX * 100}%`,
                top: `${incident.mapY * 100}%`,
                borderColor: PRIORITY_COLOR_VAR[incident.priority] ?? 'var(--priority-low)',
                background: PRIORITY_COLOR_VAR[incident.priority] ?? 'var(--priority-low)',
              }}
              title={`${incident.locationText?.split('\n')[0] ?? ''} — ${incident.type} (${incident.priority})`}
              onClick={() => onSelectIncident(incident.id)}
            />
          ))}
        </div>
      )}
      {unplottedCount > 0 && (
        <p className="venue-map-note">
          {unplottedCount} open incident{unplottedCount === 1 ? '' : 's'} not shown — location doesn't match a zone
          placed on the map yet.
        </p>
      )}
    </div>
  );
}