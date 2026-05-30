import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

// Fix default marker icons (Leaflet + bundlers)
const icon = L.icon({ iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconSize:[25,41], iconAnchor:[12,41] });

type Live = { vehicle_id:number; reg_no:string; depot_id:number; lat:number; lng:number; speed_kmh:number; ts:string };
type Depot = { id:number; name:string; lat:number; lng:number };
type LiveDetail = { vehicle_id:number; reg_no:string; driver_name:string|null; route_name:string|null; recent_pings:any[] };

function FitBounds({ pts }: { pts: [number,number][] }) {
  const map = useMap();
  useEffect(() => { if (pts.length) map.fitBounds(pts as any, { padding:[30,30] }); }, [pts.length]);
  return null;
}

export default function LiveMap() {
  const [depot, setDepot] = useState<number|"all">("all");
  const [selVid, setSelVid] = useState<number|null>(null);

  const depots = useQuery<Depot[]>({ queryKey:["depots"], queryFn:()=>api("/api/depots") });
  const live = useQuery<Live[]>({
    queryKey:["live", depot], refetchInterval: 6000,
    queryFn:()=> api(`/api/avls/live${depot==="all"?"":`?depot_id=${depot}`}`),
  });
  const detail = useQuery<LiveDetail>({
    enabled: selVid !== null,
    queryKey: ["liveDetail", selVid],
    queryFn: () => api(`/api/avls/live/${selVid}`),
    refetchInterval: 6000
  });

  const pts = (live.data||[]).map(v=>[v.lat,v.lng] as [number,number]);
  const polyPts = (detail.data?.recent_pings||[]).map((p:any)=>[p.lat,p.lng] as [number,number]);
  return (
    <div>
      <div className="card row" style={{justifyContent:"space-between"}}>
        <div>
          <strong>Live fleet</strong>{" "}
          <span className="muted">· {live.data?.length || 0} vehicles · auto-refresh 6s</span>
        </div>
        <div>
          <label style={{display:"inline",marginRight:".5rem"}}>Depot</label>
          <select value={depot} onChange={e=>setDepot(e.target.value==="all"?"all":Number(e.target.value))} style={{width:200}}>
            <option value="all">All</option>
            {depots.data?.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className={selVid ? "grid" : ""} style={selVid ? {gridTemplateColumns:"3fr 1fr"} : {}}>
        <div className="map-wrap">
          <MapContainer center={[28.6,77.3]} zoom={11} style={{height:"100%",width:"100%"}}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {live.data?.map(v=>(
              <Marker key={v.vehicle_id} position={[v.lat,v.lng]} icon={icon}
                eventHandlers={{ click: () => setSelVid(v.vehicle_id) }}>
                {selVid !== v.vehicle_id && <Popup><b>{v.reg_no}</b><br/>{v.speed_kmh.toFixed(0)} km/h<br/><small>{new Date(v.ts).toLocaleTimeString()}</small></Popup>}
              </Marker>
            ))}
            {selVid && polyPts.length > 0 && <Polyline positions={polyPts} pathOptions={{color:"#ef476f", weight:4}} />}
            <FitBounds pts={pts}/>
          </MapContainer>
        </div>
        {selVid && (
          <div className="card">
            <div className="row" style={{justifyContent:"space-between", marginBottom:"1rem"}}>
              <h3 style={{margin:0}}>Vehicle {detail.data?.reg_no || "..."}</h3>
              <button className="btn ghost" style={{padding:".2rem .5rem"}} onClick={()=>setSelVid(null)}>×</button>
            </div>
            {detail.data ? (
              <div className="kv">
                <div>Driver</div><div>{detail.data.driver_name || "Unassigned"}</div>
                <div>Route</div><div>{detail.data.route_name || "Unassigned"}</div>
                <div>Pings (30m)</div><div>{detail.data.recent_pings.length}</div>
              </div>
            ) : <p className="muted">Loading...</p>}
          </div>
        )}
      </div>
    </div>
  );
}
