import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getMe } from "../lib/api";

type N = { id:number; title:string; body:string; audience:any; publish_at:string; created_by:number; ack_required:boolean };

export default function Notices() {
  const me = getMe()!;
  const qc = useQueryClient();
  const list = useQuery<N[]>({queryKey:["notices"], queryFn:()=>api("/api/notices")});
  const [n,setN] = useState({title:"",body:"",audience:"all", ack_required:false});
  const [openId,setOpenId] = useState<number|null>(null);
  const reads = useQuery<any[]>({
    enabled: openId !== null, queryKey:["reads",openId],
    queryFn:()=> api(`/api/notices/${openId}/reads`),
  });
  const create = useMutation({
    mutationFn:(b:any)=>api("/api/notices",{method:"POST",body:JSON.stringify(b)}),
    onSuccess:()=>{ qc.invalidateQueries({queryKey:["notices"]}); setN({title:"",body:"",audience:"all", ack_required:false}); }
  });

  const aud = (a:any) => a.all? "All" : a.role? `Role: ${a.role}` : a.depot_id? `Depot ${a.depot_id}` : JSON.stringify(a);

  return (
    <div className="grid" style={{gridTemplateColumns:"2fr 1fr"}}>
      <div className="card">
        <h3 style={{marginTop:0}}>Notices</h3>
        <table>
          <thead><tr><th>Title</th><th>Audience</th><th>Published</th><th></th></tr></thead>
          <tbody>
            {list.data?.map(x=>(
              <tr key={x.id}>
                <td>{x.title}</td>
                <td>{aud(x.audience)}</td>
                <td className="muted">{new Date(x.publish_at).toLocaleString()}</td>
                <td>{(me.role==="admin"||me.role==="manager") &&
                  <button className="btn ghost" onClick={()=>setOpenId(x.id)}>Receipts</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {openId !== null && (
          <div className="card" style={{marginTop:"1rem"}}>
            <strong>Read receipts for notice #{openId}</strong>
            <button className="btn ghost" style={{float:"right"}} onClick={()=>setOpenId(null)}>Close</button>
            <table>
              <thead><tr><th>User</th><th>Read at</th></tr></thead>
              <tbody>{reads.data?.map((r:any)=>(<tr key={r.user_id}><td>{r.full_name}</td><td className="muted">{new Date(r.read_at).toLocaleString()}</td></tr>))}</tbody>
            </table>
          </div>
        )}
      </div>

      {me.role==="admin" && (
        <div className="card">
          <h3 style={{marginTop:0}}>Publish notice</h3>
          <label>Title</label><input value={n.title} onChange={e=>setN({...n,title:e.target.value})}/>
          <label>Body</label><textarea rows={4} value={n.body} onChange={e=>setN({...n,body:e.target.value})}/>
          <label>Audience</label>
          <select value={n.audience} onChange={e=>setN({...n,audience:e.target.value})}>
            <option value="all">All users</option>
            <option value="driver">All drivers</option>
            <option value="manager">All managers</option>
          </select>
          <label style={{margin:".5rem 0",display:"flex",alignItems:"center",gap:".25rem"}}>
            <input type="checkbox" checked={n.ack_required} onChange={e=>setN({...n,ack_required:e.target.checked})} style={{width:"auto"}}/> Require explicit acknowledgement
          </label>
          <button className="btn" style={{marginTop:".5rem"}} disabled={!n.title||!n.body}
            onClick={()=>create.mutate({title:n.title, body:n.body, ack_required:n.ack_required,
              audience: n.audience==="all"?{all:true}:{role:n.audience}})}>Publish</button>
        </div>
      )}
    </div>
  );
}
