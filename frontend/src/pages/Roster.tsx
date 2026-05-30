import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getMe } from "../lib/api";

type Duty = { id:number; date:string; driver_id:number; vehicle_id:number; route_id:number; depot_id:number; published:boolean; acknowledged:boolean };
type U = { id:number; full_name:string; role:string; depot_id:number|null };
type V = { id:number; reg_no:string; depot_id:number };
type R = { id:number; name:string; depot_id:number };
type D = { id:number; name:string };

function weekDays(start: Date) {
  return Array.from({length:7}, (_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d.toISOString().slice(0,10); });
}

export default function Roster() {
  const me = getMe()!;
  const today = new Date(); const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay()+6)%7));
  const [weekStart, setWeekStart] = useState<string>(monday.toISOString().slice(0,10));
  const days = useMemo(()=>weekDays(new Date(weekStart)), [weekStart]);
  const end = days[6];
  const depotId = me.role==="manager"? me.depot_id : undefined;

  const qc = useQueryClient();
  const depots = useQuery<D[]>({queryKey:["depots"], queryFn:()=>api("/api/depots")});
  const drivers = useQuery<U[]>({queryKey:["drivers"], queryFn:()=>api("/api/users?role=driver")});
  const vehicles = useQuery<V[]>({queryKey:["vehicles"], queryFn:()=>api("/api/vehicles")});
  const routes = useQuery<R[]>({queryKey:["routes"], queryFn:()=>api("/api/routes")});
  const duties = useQuery<Duty[]>({
    queryKey:["duties", weekStart, end, depotId],
    queryFn:()=> api(`/api/duties?start=${weekStart}&end=${end}${depotId?`&depot_id=${depotId}`:""}`)
  });

  const filteredDrivers = (drivers.data||[]).filter(d=> depotId? d.depot_id===depotId : true);
  const dutyMap = new Map<string, Duty>();
  duties.data?.forEach(x=> dutyMap.set(`${x.driver_id}|${x.date}`, x));

  const assign = useMutation({
    mutationFn:(body:any)=> api("/api/duties",{method:"POST", body: JSON.stringify(body)}),
    onSuccess:()=> qc.invalidateQueries({queryKey:["duties"]}),
  });
  const publish = useMutation({
    mutationFn:()=> api(`/api/duties/publish?start=${weekStart}&end=${end}${depotId?`&depot_id=${depotId}`:""}`, {method:"POST"}),
    onSuccess:()=> qc.invalidateQueries({queryKey:["duties"]}),
  });

  const [form,setForm] = useState<{date:string; driver_id:number}|null>(null);
  const [vehId,setVehId] = useState<number|"">(""); const [routeId,setRouteId] = useState<number|"">("");

  return (
    <div>
      <div className="card row" style={{justifyContent:"space-between"}}>
        <div>
          <strong>Weekly Roster</strong>{" "}
          <span className="muted">{weekStart} → {end}</span>
        </div>
        <div className="row">
          <input type="date" value={weekStart} onChange={e=>setWeekStart(e.target.value)} />
          <button className="btn" onClick={()=>publish.mutate()}>Publish week</button>
        </div>
      </div>

      <div className="card" style={{overflowX:"auto"}}>
        <table>
          <thead><tr><th>Driver</th>{days.map(d=> <th key={d}>{d.slice(5)}</th>)}</tr></thead>
          <tbody>
          {filteredDrivers.map(drv=> (
            <tr key={drv.id}>
              <td>{drv.full_name}</td>
              {days.map(d=>{
                const x = dutyMap.get(`${drv.id}|${d}`);
                const veh = x && vehicles.data?.find(v=>v.id===x.vehicle_id);
                const rt = x && routes.data?.find(r=>r.id===x.route_id);
                return <td key={d}>
                  {x ? <div>
                      <div>{veh?.reg_no}</div>
                      <div className="muted">{rt?.name}</div>
                      {x.published && <span className="badge resolved">published</span>}
                    </div>
                   : <button className="btn ghost" onClick={()=>{ setForm({date:d, driver_id:drv.id}); setVehId(""); setRouteId(""); }}>Assign</button>}
                </td>;
              })}
            </tr>
          ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="card">
          <h3 style={{marginTop:0}}>Assign duty — {form.date}</h3>
          <label>Vehicle</label>
          <select value={vehId} onChange={e=>setVehId(Number(e.target.value))}>
            <option value="">--</option>
            {(vehicles.data||[]).filter(v=> depotId? v.depot_id===depotId: true).map(v=> <option key={v.id} value={v.id}>{v.reg_no}</option>)}
          </select>
          <label>Route</label>
          <select value={routeId} onChange={e=>setRouteId(Number(e.target.value))}>
            <option value="">--</option>
            {(routes.data||[]).filter(r=> depotId? r.depot_id===depotId: true).map(r=> <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="row" style={{marginTop:".75rem"}}>
            <button className="btn" disabled={!vehId||!routeId} onClick={()=>{
              const drv = filteredDrivers.find(d=>d.id===form.driver_id);
              assign.mutate({date:form.date, driver_id:form.driver_id, vehicle_id:vehId, route_id:routeId, depot_id: drv!.depot_id});
              setForm(null);
            }}>Save</button>
            <button className="btn ghost" onClick={()=>setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
