import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Polyline, Marker, useMap } from "react-leaflet";
import { useSearchParams } from "react-router-dom";
import L from "leaflet";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

const icon = L.icon({ iconUrl:"https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png", iconSize:[25,41], iconAnchor:[12,41]});

type V = { id:number; reg_no:string };
type P = { ts:string; lat:number; lng:number; speed_kmh:number };

function Fit({ path }:{ path:[number,number][] }) {
  const map = useMap();
  if (path.length) setTimeout(()=>map.fitBounds(path as any,{padding:[30,30]}),50);
  return null;
}

export default function History() {
  const [params] = useSearchParams();
  const vehicles = useQuery<V[]>({queryKey:["vehicles"], queryFn:()=>api("/api/vehicles")});
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
  const [vid,setVid] = useState<number|"">(params.get("vid") ? Number(params.get("vid")) : "");
  const [day,setDay] = useState<string>(params.get("date") || yesterday);
  const hist = useQuery<P[]>({
    enabled: !!vid, queryKey:["hist",vid,day],
    queryFn:()=>api(`/api/avls/history/${vid}?day=${day}`),
  });
  const path = (hist.data||[]).map(p=>[p.lat,p.lng] as [number,number]);

  const [playing, setPlaying] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => { setFrame(0); setPlaying(false); }, [vid, day, path.length]);

  useEffect(() => {
    if (!playing || path.length === 0) return;
    const interval = setInterval(() => {
      setFrame(f => {
        if (f + 1 >= path.length) { setPlaying(false); return path.length - 1; }
        return f + 1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing, path.length]);

  return (
    <div>
      <div className="card row" style={{gap:"1rem"}}>
        <div style={{flex:1}}>
          <label>Vehicle</label>
          <select value={vid} onChange={e=>setVid(e.target.value? Number(e.target.value):"")}>
            <option value="">-- pick a vehicle --</option>
            {vehicles.data?.map(v=> <option key={v.id} value={v.id}>{v.reg_no}</option>)}
          </select>
        </div>
        <div style={{flex:1}}>
          <label>Date</label>
          <input type="date" value={day} onChange={e=>setDay(e.target.value)} />
        </div>
        <div className="muted" style={{alignSelf:"end"}}>{hist.data?.length ?? 0} pings</div>
      </div>
      {path.length > 0 && (
        <div className="card row" style={{padding:".75rem", marginBottom:"1rem"}}>
          <button className="btn" style={{padding:".2rem .75rem"}} onClick={()=>setPlaying(!playing)}>{playing ? "⏸ Pause" : "▶ Play"}</button>
          <input type="range" min={0} max={path.length-1} value={frame} onChange={e=>{setFrame(Number(e.target.value)); setPlaying(false);}} style={{flex:1}} />
          <span className="muted" style={{minWidth: 80, textAlign:"right"}}>{new Date((hist.data as any)[frame]?.ts).toLocaleTimeString()}</span>
        </div>
      )}
      <div className="map-wrap" style={{height:"calc(100vh - 220px)"}}>
        <MapContainer center={[28.6,77.3]} zoom={11} style={{height:"100%",width:"100%"}}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {path.length>0 && <>
            <Polyline positions={path.slice(0, frame+1)} pathOptions={{color:"#5bc0be", weight:4}} />
            <Marker position={path[frame]} icon={icon} />
            {frame === 0 && <Fit path={path}/>}
          </>}
        </MapContainer>
      </div>
    </div>
  );
}
