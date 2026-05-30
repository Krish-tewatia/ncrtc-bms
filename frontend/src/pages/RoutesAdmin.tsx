import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

type Stop = { seq:number; name:string; lat:number; lng:number; planned_time:string };
type R = { id:number; name:string; depot_id:number; stops: Stop[] };
type D = { id:number; name:string; lat:number; lng:number };

export default function RoutesAdmin() {
  const qc = useQueryClient();
  const routes = useQuery<R[]>({queryKey:["routes"], queryFn:()=>api("/api/routes")});
  const depots = useQuery<D[]>({queryKey:["depots"], queryFn:()=>api("/api/depots")});
  const [name,setName] = useState(""); const [depotId,setDepotId] = useState<number|"">("");
  const [stops,setStops] = useState<Stop[]>([{seq:1,name:"Stop 1",lat:28.6,lng:77.3,planned_time:"07:00"}]);

  const create = useMutation({
    mutationFn:(body:any)=> api("/api/routes",{method:"POST",body:JSON.stringify(body)}),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["routes"]}); setName(""); setStops([{seq:1,name:"Stop 1",lat:28.6,lng:77.3,planned_time:"07:00"}]); }
  });
  const del = useMutation({
    mutationFn:(id:number)=>api(`/api/routes/${id}`,{method:"DELETE"}),
    onSuccess:()=>qc.invalidateQueries({queryKey:["routes"]}),
  });

  return (
    <div className="grid" style={{gridTemplateColumns:"1fr 1fr"}}>
      <div className="card">
        <h3 style={{marginTop:0}}>Create route</h3>
        <label>Name</label><input value={name} onChange={e=>setName(e.target.value)} />
        <label>Depot</label>
        <select value={depotId} onChange={e=>setDepotId(Number(e.target.value))}>
          <option value="">--</option>
          {depots.data?.map(d=> <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label>Stops</label>
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Lat</th><th>Lng</th><th>Time</th><th></th></tr></thead>
          <tbody>
            {stops.map((s,i)=>(
              <tr key={i}>
                <td>{s.seq}</td>
                <td><input value={s.name} onChange={e=>{const c=[...stops]; c[i]={...s,name:e.target.value}; setStops(c);}}/></td>
                <td><input value={s.lat} onChange={e=>{const c=[...stops]; c[i]={...s,lat:Number(e.target.value)}; setStops(c);}}/></td>
                <td><input value={s.lng} onChange={e=>{const c=[...stops]; c[i]={...s,lng:Number(e.target.value)}; setStops(c);}}/></td>
                <td><input value={s.planned_time} onChange={e=>{const c=[...stops]; c[i]={...s,planned_time:e.target.value}; setStops(c);}}/></td>
                <td><button className="btn ghost" onClick={()=>setStops(stops.filter((_,j)=>j!==i).map((x,k)=>({...x,seq:k+1})))}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="btn ghost" style={{marginTop:".5rem"}} onClick={()=>setStops([...stops,{seq:stops.length+1,name:`Stop ${stops.length+1}`,lat:28.6,lng:77.3,planned_time:"07:30"}])}>+ Add stop</button>
        <div style={{marginTop:".75rem"}}>
          <button className="btn" disabled={!name||!depotId||stops.length<2} onClick={()=>create.mutate({name,depot_id:depotId,stops})}>Create route</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{marginTop:0}}>Existing routes</h3>
        <table>
          <thead><tr><th>Name</th><th>Depot</th><th>Stops</th><th></th></tr></thead>
          <tbody>
            {routes.data?.map(r=>(
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{depots.data?.find(d=>d.id===r.depot_id)?.name}</td>
                <td>{r.stops.length}</td>
                <td><button className="btn danger" onClick={()=>del.mutate(r.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
