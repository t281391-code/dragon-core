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

const MAP_CENTER: [number, number] = [47.89, 106.9];

const STATUS_CFG: Record<VehicleStatus, { color: string; label: string; tone: string }> = {
  active:  { color: "#22c55e", label: "Идэвхтэй", tone: "active" },
  waiting: { color: "#f59e0b", label: "Хүлээгдэж байна", tone: "waiting" },
  delayed: { color: "#ef4444", label: "Саатал", tone: "delayed" },
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char] ?? char);
}

function makeTruckPin(L: typeof import("leaflet"), status: VehicleStatus) {
  const { color, tone } = STATUS_CFG[status] ?? STATUS_CFG.active;
  return L.divIcon({
    className: "tmap-vehicle-icon",
    html: `
      <div class="tmap-truck tmap-truck--${tone}" style="--tmap-color:${color}">
        <span class="tmap-truck__ring"></span>
        <span class="tmap-truck__body">🚚</span>
      </div>`,
    iconSize: [42, 36],
    iconAnchor: [21, 18],
    popupAnchor: [0, -18],
  });
}

function makeDepotPin(L: typeof import("leaflet")) {
  return L.divIcon({
    className: "tmap-depot-icon",
    html: `
      <div class="tmap-depot">
        <span class="tmap-depot__pulse"></span>
        <span class="tmap-depot__mark">▣</span>
      </div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
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
    const markers = markersRef.current;
    const polylines = polylinesRef.current;
    const trails = trailsRef.current;

    const init = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!mounted || !containerRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(containerRef.current, {
        center: MAP_CENTER,
        zoom: 10,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { attribution: "&copy; OpenStreetMap &copy; CARTO", maxZoom: 19, subdomains: "abcd" }
      ).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.circle(MAP_CENTER, {
        radius: 4200,
        color: "#38bdf8",
        weight: 1,
        opacity: 0.3,
        fillColor: "#38bdf8",
        fillOpacity: 0.04,
        interactive: false,
      }).addTo(map);
      L.marker(MAP_CENTER, { icon: makeDepotPin(L), interactive: false }).addTo(map);
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 80);

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
        const icon = makeTruckPin(L, status2);
        const safeId = escapeHtml(id);
        const safeDestination = destination ? escapeHtml(destination) : "";

        const popupHtml = `
          <div class="tmap-popup">
            <div class="tmap-popup__header" style="border-left:4px solid ${color}">
              <span class="tmap-popup__truck">🚛</span>
              <span class="tmap-popup__id">${safeId}</span>
            </div>
            <div class="tmap-popup__body">
              <div class="tmap-popup__row">
                <span class="tmap-popup__key">Статус</span>
                <span class="tmap-popup__val" style="color:${color}">${label}</span>
              </div>
              ${destination ? `
              <div class="tmap-popup__row">
                <span class="tmap-popup__key">Очих газар</span>
                <span class="tmap-popup__val">${safeDestination}</span>
              </div>` : ""}
            </div>
          </div>`;

        if (markers.has(id)) {
          const m = markers.get(id)!;
          m.setLatLng(latlng);
          m.setIcon(icon);
          m.setPopupContent(popupHtml);
        } else {
          const m = L.marker(latlng, { icon })
            .bindPopup(popupHtml, { className: "tmap-popup-wrap", maxWidth: 240, offset: [0, -4] })
            .addTo(map);
          markers.set(id, m);
        }

        const trail = trails.get(id) ?? [];
        trail.push(latlng);
        if (trail.length > 30) trail.shift();
        trails.set(id, trail);

        const route = trail.length >= 2 ? trail : [MAP_CENTER, latlng];
        const routeStyle = {
          color,
          weight: 4,
          opacity: 0.9,
          lineCap: "round" as const,
          lineJoin: "round" as const,
          className: "tmap-route-line",
        };

        if (polylines.has(id)) {
          polylines.get(id)!.setLatLngs(route).setStyle(routeStyle);
        } else {
          const pl = L.polyline(route, routeStyle).addTo(map);
          polylines.set(id, pl);
        }

        const positions = [...markers.values()].map((m) => m.getLatLng());
        if (positions.length === 1) {
          map.fitBounds(L.latLngBounds([MAP_CENTER, latlng]), { padding: [48, 48], maxZoom: 11 });
        } else if (positions.length <= 8) {
          map.fitBounds(L.latLngBounds([MAP_CENTER, ...positions]), { padding: [48, 48], maxZoom: 11 });
        }
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
      markers.clear();
      polylines.clear();
      trails.clear();
    };
  }, []);

  return (
    <div className="transport-map">
      <div className="transport-map__badge">
        <span aria-hidden="true" />
        REALTIME
      </div>
      <div className="transport-map__legend" aria-hidden="true">
        <span>Plant</span>
        <strong>Live route</strong>
      </div>
      <div ref={containerRef} className="transport-map__canvas" />
    </div>
  );
}
