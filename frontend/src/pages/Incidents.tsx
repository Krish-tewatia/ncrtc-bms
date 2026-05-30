import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getMe } from "../lib/api";

type Inc = { id:number; type:string; severity:string; status:string; description:string;
  depot_id:number|null; vehicle_id:number|null; reporter_id:number; assignee_id:number|null;
  created_at:string; events: any[] };
type U = { id:number; full_name:string; role:string };

const NEXT: Record<string,string[]> = {
  open:["ack","resolved","closed"],
  ack:["inprogress","resolved","closed"],
  inprogress:["resolved","closed"],
  resolved:["closed"], closed:[],
};

function getSLA(created_at: string, severity: string, status: string) {
  if (status === "resolved" || status === "closed") return { breached: false, text: "—" };
  const hours = severity === "P1" ? 1 : severity === "P2" ? 4 : 24;
  const deadline = new Date(new Date(created_at).getTime() + hours * 3600000);
  const diff = deadline.getTime() - Date.now();
  if (diff < 0) return { breached: true, text: "Breached" };
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return { breached: false, text: `${h}h ${m}m left` };
}

export default function Incidents() {
  const me = getMe()!;
  const qc = useQueryClient();
  const nav = useNavigate();
  const [status,setStatus] = useState<string>("");
  const [severity,setSeverity] = useState<string>("");
  const [depotId,setDepotId] = useState<number|"">("");
  const [mineOnly,setMineOnly] = useState(false);
  const list = useQuery<Inc[]>({
    queryKey:["inc",status,severity,depotId,mineOnly], 
    queryFn:()=> {
      const q = new URLSearchParams();
      if(status) q.append("status",status);
      if(severity) q.append("severity",severity);
      if(depotId) q.append("depot_id",depotId.toString());
      if(mineOnly) q.append("mine_only","true");
      return api(`/api/incidents?${q.toString()}`);
    }
  });
  const users = useQuery<U[]>({queryKey:["users"], queryFn:()=>api("/api/users")});
  const depots = useQuery<any[]>({queryKey:["depots"], queryFn:()=>api("/api/depots")});
  const vehicles = useQuery<any[]>({queryKey:["vehicles"], queryFn:()=>api("/api/vehicles")});
  const [sel,setSel] = useState<Inc|null>(null);
  const [note,setNote] = useState("");

  const create = useMutation({
    mutationFn:(b:any)=>api("/api/incidents",{method:"POST",body:JSON.stringify(b)}),
    onSuccess:()=>qc.invalidateQueries({queryKey:["inc"]})
  });
  const update = useMutation({
    mutationFn:({id,body}:any)=>api(`/api/incidents/${id}`,{method:"PATCH",body:JSON.stringify(body)}),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["inc"]}); setNote(""); }
  });

  const [nt,setNt] = useState({type:"breakdown",severity:"P2",description:"",vehicle_id:"",photo:""});

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if(f) {
      const r = new FileReader();
      r.onload = () => setNt(prev=>({...prev, photo: r.result as string}));
      r.readAsDataURL(f);
    }
  };

  return (
    <div className="grid" style={{gridTemplateColumns:"2fr 1fr"}}>
      <div>
        <div className="card row" style={{justifyContent:"space-between", flexWrap:"wrap"}}>
          <div><strong>Incidents</strong> <span className="muted">· {list.data?.length ?? 0}</span></div>
          <div className="row" style={{flexWrap:"wrap"}}>
            <label style={{margin:0,display:"flex",alignItems:"center",gap:".25rem"}}>
              <input type="checkbox" checked={mineOnly} onChange={e=>setMineOnly(e.target.checked)} style={{width:"auto"}}/> Mine
            </label>
            <select value={severity} onChange={e=>setSeverity(e.target.value)} style={{width:100}}>
              <option value="">All Sev</option>
              <option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option>
            </select>
            <select value={depotId} onChange={e=>setDepotId(e.target.value?Number(e.target.value):"")} style={{width:120}}>
              <option value="">All Depots</option>
              {depots.data?.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={status} onChange={e=>setStatus(e.target.value)} style={{width:130}}>
              <option value="">All statuses</option>
              {Object.keys(NEXT).map(s=> <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="card" style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>#</th><th>Type</th><th>Sev</th><th>Status</th><th>Created</th><th>SLA</th><th>Assignee</th></tr></thead>
            <tbody>
              {list.data?.map(i=>{
                const sla = getSLA(i.created_at, i.severity, i.status);
                return (
                  <tr key={i.id} style={{cursor:"pointer", background: sla.breached ? "#3a151b" : undefined}} onClick={()=>setSel(i)}>
                    <td>{i.id}</td><td>{i.type}</td>
                    <td><span className={`badge ${i.severity}`}>{i.severity}</span></td>
                    <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                    <td className="muted">{new Date(i.created_at).toLocaleString()}</td>
                    <td style={{color: sla.breached ? "#ef476f" : "var(--muted)"}}>{sla.text}</td>
                    <td>{users.data?.find(u=>u.id===i.assignee_id)?.full_name || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="card">
          <h3 style={{marginTop:0}}>Raise incident</h3>
          <label>Type</label>
          <select value={nt.type} onChange={e=>setNt({...nt,type:e.target.value})}>
            {["breakdown","accident","complaint","noshow","other"].map(x=> <option key={x}>{x}</option>)}
          </select>
          <label>Severity</label>
          <select value={nt.severity} onChange={e=>setNt({...nt,severity:e.target.value})}>
            <option>P1</option><option>P2</option><option>P3</option>
          </select>
          <label>Description</label>
          <textarea rows={3} value={nt.description} onChange={e=>setNt({...nt,description:e.target.value})}/>
          <label>Vehicle (optional)</label>
          <select value={nt.vehicle_id} onChange={e=>setNt({...nt,vehicle_id:e.target.value})}>
            <option value="">-- None --</option>
            {vehicles.data?.map(v=> <option key={v.id} value={v.id}>{v.reg_no}</option>)}
          </select>
          <label>Photo (optional)</label>
          <input type="file" accept="image/*" onChange={handlePhoto} />
          {nt.photo && <img src={nt.photo} style={{maxHeight:100, display:"block", marginTop:".5rem", borderRadius:6}} />}
          <button className="btn" style={{marginTop:".5rem"}} onClick={()=>create.mutate({...nt, vehicle_id: nt.vehicle_id ? Number(nt.vehicle_id) : undefined, photo: nt.photo || undefined})}>Create</button>
        </div>

        {sel && (
          <div className="card">
            <h3 style={{marginTop:0}}>Incident #{sel.id}</h3>
            <div className="kv">
              <div>Type</div><div>{sel.type}</div>
              <div>Severity</div><div><span className={`badge ${sel.severity}`}>{sel.severity}</span></div>
              <div>Status</div><div><span className={`badge ${sel.status}`}>{sel.status}</span></div>
              <div>Vehicle</div><div>{sel.vehicle_id ? (
                <div className="row">
                  {vehicles.data?.find(v=>v.id===sel.vehicle_id)?.reg_no}
                  <button className="btn ghost" style={{padding:".2rem .5rem", fontSize:".8rem"}} onClick={()=>nav(`/history?vid=${sel.vehicle_id}&date=${sel.created_at.slice(0,10)}`)}>
                    View map path
                  </button>
                </div>
              ) : "—"}</div>
              <div>Description</div><div>{sel.description||"—"}</div>
            </div>
            {(sel as any).photo && <img src={(sel as any).photo} style={{maxWidth:"100%", maxHeight:200, borderRadius:6, marginTop:".5rem"}}/>}
            <label>Assign to</label>
            <select value={sel.assignee_id ?? ""} onChange={e=>update.mutate({id:sel.id, body:{assignee_id: Number(e.target.value)}})}>
              <option value="">--</option>
              {users.data?.filter(u=>["manager","operator","admin"].includes(u.role))
                .map(u=> <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>)}
            </select>
            <label>Add note / change status</label>
            <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} />
            <div className="row" style={{marginTop:".5rem", flexWrap:"wrap"}}>
              <button className="btn ghost" onClick={()=>update.mutate({id:sel.id, body:{note}})}>Add note</button>
              {NEXT[sel.status].map(ns=>
                <button key={ns} className="btn" onClick={()=>update.mutate({id:sel.id, body:{to_status:ns, note}})}>→ {ns}</button>
              )}
            </div>
            <h4>Timeline</h4>
            <table>
              <tbody>
                {sel.events.map((e:any)=>(
                  <tr key={e.id}>
                    <td className="muted">{new Date(e.ts).toLocaleString()}</td>
                    <td>{e.from_status||"·"} → <b>{e.to_status}</b></td>
                    <td>{e.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
