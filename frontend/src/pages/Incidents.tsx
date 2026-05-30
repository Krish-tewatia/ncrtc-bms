import { useState } from "react";
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

export default function Incidents() {
  const me = getMe()!;
  const qc = useQueryClient();
  const [status,setStatus] = useState<string>("");
  const list = useQuery<Inc[]>({queryKey:["inc",status], queryFn:()=>api(`/api/incidents${status?`?status=${status}`:""}`)});
  const users = useQuery<U[]>({queryKey:["users"], queryFn:()=>api("/api/users")});
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

  const [nt,setNt] = useState({type:"breakdown",severity:"P2",description:""});

  return (
    <div className="grid" style={{gridTemplateColumns:"2fr 1fr"}}>
      <div>
        <div className="card row" style={{justifyContent:"space-between"}}>
          <div><strong>Incidents</strong> <span className="muted">· {list.data?.length ?? 0}</span></div>
          <select value={status} onChange={e=>setStatus(e.target.value)} style={{width:180}}>
            <option value="">All statuses</option>
            {Object.keys(NEXT).map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="card" style={{overflowX:"auto"}}>
          <table>
            <thead><tr><th>#</th><th>Type</th><th>Sev</th><th>Status</th><th>Created</th><th>Assignee</th></tr></thead>
            <tbody>
              {list.data?.map(i=>(
                <tr key={i.id} style={{cursor:"pointer"}} onClick={()=>setSel(i)}>
                  <td>{i.id}</td><td>{i.type}</td>
                  <td><span className={`badge ${i.severity}`}>{i.severity}</span></td>
                  <td><span className={`badge ${i.status}`}>{i.status}</span></td>
                  <td className="muted">{new Date(i.created_at).toLocaleString()}</td>
                  <td>{users.data?.find(u=>u.id===i.assignee_id)?.full_name || "—"}</td>
                </tr>
              ))}
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
          <button className="btn" style={{marginTop:".5rem"}} onClick={()=>create.mutate(nt)}>Create</button>
        </div>

        {sel && (
          <div className="card">
            <h3 style={{marginTop:0}}>Incident #{sel.id}</h3>
            <div className="kv">
              <div>Type</div><div>{sel.type}</div>
              <div>Severity</div><div><span className={`badge ${sel.severity}`}>{sel.severity}</span></div>
              <div>Status</div><div><span className={`badge ${sel.status}`}>{sel.status}</span></div>
              <div>Description</div><div>{sel.description||"—"}</div>
            </div>
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
