import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { adminApi } from '../../lib/api/admin';
import { EmptyState, ErrorBanner, Spinner } from '../../components/Spinner';
import { Map } from 'lucide-react';

const SEQUENTIAL_STEPS = ['#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4338ca'];

function colorForCount(count: number, max: number): string {
  const ratio = max <= 1 ? 1 : count / max;
  const index = Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor(ratio * (SEQUENTIAL_STEPS.length - 1)));
  return SEQUENTIAL_STEPS[index];
}

function radiusForCount(count: number, max: number): number {
  const ratio = max <= 1 ? 1 : count / max;
  return 8 + ratio * 22;
}

export function AdminHeatmapPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-heatmap'],
    queryFn: () => adminApi.heatmap(),
  });

  const maxCount = useMemo(() => Math.max(1, ...(data?.map((c) => c.complaint_count) ?? [1])), [data]);
  const center = useMemo((): [number, number] => {
    if (!data || data.length === 0) return [20.5937, 78.9629];
    const lat = data.reduce((sum, c) => sum + c.latitude, 0) / data.length;
    const lng = data.reduce((sum, c) => sum + c.longitude, 0) / data.length;
    return [lat, lng];
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="section-header">
        <div>
          <h1 className="page-title">Complaint Heat Map</h1>
          <p className="page-subtitle">
            Complaints clustered into a ~100m grid. Darker circles indicate higher complaint density.
          </p>
        </div>
      </div>

      {/* Legend */}
      {data && data.length > 0 && (
        <div className="card p-4 animate-fade-in">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Complaint density</span>
            <div className="flex items-center gap-2">
              {SEQUENTIAL_STEPS.map((color, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ background: color, opacity: 0.8 }}
                  />
                  {i === 0 && <span className="text-xs text-slate-400">Low</span>}
                  {i === SEQUENTIAL_STEPS.length - 1 && <span className="text-xs text-slate-400">High</span>}
                </div>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
              <Map size={14} className="text-indigo-400" />
              {data.length} cluster{data.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      )}

      {isLoading && <Spinner label="Loading heat map data…" />}
      {error && <ErrorBanner message="Could not load the heat map." />}
      {data && data.length === 0 && (
        <EmptyState
          message="No geolocated complaints yet"
          description="Complaints with location data will appear on this map."
        />
      )}

      {data && data.length > 0 && (
        <div
          className="card overflow-hidden animate-fade-in-up"
          style={{ height: 540 }}
        >
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {data.map((cell, i) => (
              <CircleMarker
                key={i}
                center={[cell.latitude, cell.longitude]}
                radius={radiusForCount(cell.complaint_count, maxCount)}
                pathOptions={{
                  color: colorForCount(cell.complaint_count, maxCount),
                  fillColor: colorForCount(cell.complaint_count, maxCount),
                  fillOpacity: 0.7,
                  weight: 2,
                }}
              >
                <Popup>
                  <div style={{ fontFamily: 'Inter, sans-serif', minWidth: '140px' }}>
                    <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '13px' }}>
                      {cell.dominant_department ?? 'Mixed'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      {cell.complaint_count} complaint{cell.complaint_count === 1 ? '' : 's'}
                    </div>
                    {cell.critical_count > 0 && (
                      <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>⚠</span> {cell.critical_count} critical
                      </div>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
        </div>
      )}
    </div>
  );
}
