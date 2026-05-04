"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

type VehicleStatus = "active" | "waiting" | "delayed";

interface VehicleEvent {
  id: string;
  lat: number;
  lng: number;
  status: VehicleStatus;
  destination?: string;
}

const STATUS_CFG: Record<VehicleStatus, { color: string; label: string }> = {
  active:  { color: "#22c55e", label: "Идэвхтэй" },
  waiting: { color: "#f59e0b", label: "Хүлээгдэж байна" },
  delayed: { color: "#ef4444", label: "Саатал" },
};

function makePin(L: typeof import("leaflet"), status: VehicleStatus) {
  const { color } = STATUS_CFG[status] ?? STATUS_CFG.active;
  const pulse = status === "delayed"
    ? `style="animation:tmap-pulse 1.4s ease-out infinite;"`
    : "";
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="40" viewBox="0 0 28 40" ${pulse}>
      <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 26 14 26S28 24.5 28 14C28 6.27 21.73 0 14 0z"
            fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="14" cy="14" r="5.5" fill="white"/>
    </svg>`;
  return L.divIcon({
    className: "",
    html: `<div style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.35)) drop-shadow(0 0 8px ${color}88)">${svg}</div>`,
    iconSize:    [28, 40],
    iconAnchor:  [14, 40],
    popupAnchor: [0, -42],
  });
}

export default function TransportMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<import("leaflet").Map | null>(null);
  const markersRef   = useRef(new Map<string, import("leaflet").Marker>());
  const polylinesRef = useRef(new Map<string, import("leaflet").Polyline>());
  const trailsRef    = useRef(new Map<string, [number, number][]>());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let mounted = true;

    const init = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!mounted || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(containerRef.current, {
        center: [47.89, 106.9],
        zoom: 6,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles &copy; Esri", maxZoom: 19 }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;

      const socket = io("http://localhost:3002", { transports: ["websocket"] });
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") map.closePopup();
      };

      window.addEventListener("keydown", handleEscape);

      socket.on("location", (data: VehicleEvent) => {
        if (!mounted) return;
        const { id, lat, lng, status, destination } = data;
        const status2 = (status in STATUS_CFG ? status : "active") as VehicleStatus;
        const { color, label } = STATUS_CFG[status2];
        const latlng: [number, number] = [lat, lng];
        const icon = makePin(L, status2);

        const popupHtml = `
          <div class="tmap-popup">
            <div class="tmap-popup__header" style="border-left:4px solid ${color}">
              <span class="tmap-popup__truck">🚛</span>
              <span class="tmap-popup__id">${id}</span>
            </div>
            <div class="tmap-popup__body">
              <div class="tmap-popup__row">
                <span class="tmap-popup__key">Статус</span>
                <span class="tmap-popup__val" style="color:${color}">${label}</span>
              </div>
              ${destination ? `
              <div class="tmap-popup__row">
                <span class="tmap-popup__key">Очих газар</span>
                <span class="tmap-popup__val">${destination}</span>
              </div>` : ""}
            </div>
          </div>`;

        if (markersRef.current.has(id)) {
          const m = markersRef.current.get(id)!;
          m.setLatLng(latlng);
          m.setIcon(icon);
        } else {
          const m = L.marker(latlng, { icon })
            .bindPopup(popupHtml, { className: "tmap-popup-wrap", maxWidth: 240, offset: [0, -4] })
            .addTo(map);
          markersRef.current.set(id, m);
        }

        const trail = trailsRef.current.get(id) ?? [];
        trail.push(latlng);
        if (trail.length > 30) trail.shift();
        trailsRef.current.set(id, trail);

        if (polylinesRef.current.has(id)) {
          polylinesRef.current.get(id)!.setLatLngs(trail);
        } else if (trail.length >= 2) {
          const pl = L.polyline(trail, { color, weight: 3, opacity: 0.45, dashArray: "6 5" }).addTo(map);
          polylinesRef.current.set(id, pl);
        }

        const positions = [...markersRef.current.values()].map((m) => m.getLatLng());
        if (positions.length === 1) map.setView(latlng, 9);
        else if (positions.length <= 8) map.fitBounds(L.latLngBounds(positions), { padding: [48, 48], maxZoom: 10 });
      });

      return () => {
        window.removeEventListener("keydown", handleEscape);
        socket.disconnect();
      };
    };

    const cleanup = init().catch(console.error);

    return () => {
      mounted = false;
      cleanup.then((fn) => fn?.());
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      polylinesRef.current.clear();
      trailsRef.current.clear();
    };
  }, []);

  return (
    <div style={{ position: "relative", height: "100%", minHeight: 320 }}>

      {/* Realtime badge */}
      <div style={{
        position: "absolute", top: 12, right: 12, zIndex: 1000,
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(255,255,255,0.95)",
        border: "1px solid rgba(34,197,94,0.5)",
        borderRadius: 999, padding: "5px 13px",
        fontSize: 10, fontWeight: 800, color: "#16a34a",
        letterSpacing: "0.1em",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        pointerEvents: "none",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#22c55e", animation: "blink 1.4s infinite",
        }} />
        REALTIME
      </div>


      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
