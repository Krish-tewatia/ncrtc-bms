import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getMe } from "../lib/api";

type Duty = { id:number; date:string; vehicle_id:number; route_id:number; acknowledged:boolean };
type N = { id:number; title:string; body:string; publish_at:string; ack_required:boolean };

export default function Driver() {
  const me = getMe()!;
  const qc = useQueryClient();
  const duties = useQuery<Duty[]>({queryKey:["mine"], queryFn:()=>api("/api/duties/mine")});
  const feed = useQuery<N[]>({queryKey:["feed"], queryFn:()=>api("/api/notices/feed"), refetchInterval: 30_000});
  const today = new Date().toISOString().slice(0,10);
  const todays = duties.data?.find(d=>d.date===today);

  const ack = useMutation({mutationFn:(id:number)=>api(`/api/duties/${id}/ack`,{method:"POST"}),
    onSuccess:()=>qc.invalidateQueries({queryKey:["mine"]})});
  const panic = useMutation({mutationFn:()=>api(`/api/incidents/panic`,{method:"POST"}),
    onSuccess:()=>alert("Panic logged. Control room notified.")});
  const read = useMutation({mutationFn:(id:number)=>api(`/api/notices/${id}/read`,{method:"POST"}),
    onSuccess:()=>qc.invalidateQueries({queryKey:["feed"]})});

  return (
    <div className="driver">
      <div className="card">
        <h2 style={{marginTop:0}}>Hi, {me.full_name}</h2>
        <p className="muted">Today: {today}</p>
        {todays ? <div>
          <div className="kv">
            <div>Vehicle</div><div>#{todays.vehicle_id}</div>
            <div>Route</div><div>#{todays.route_id}</div>
            <div>Status</div><div>{todays.acknowledged? "✅ Acknowledged":"Pending"}</div>
          </div>
          {!todays.acknowledged && <button className="btn" style={{marginTop:".75rem"}} onClick={()=>ack.mutate(todays.id)}>Acknowledge duty</button>}
        </div> : <p>No duty assigned for today.</p>}
      </div>

      <div className="card">
        <h3 style={{marginTop:0}}>Unread notices</h3>
        {feed.data?.length ? feed.data.map(n=>(
          <div key={n.id} style={{borderBottom:"1px solid #2a3556",padding:".5rem 0", background: n.ack_required ? "rgba(239, 71, 111, 0.1)" : "transparent"}}>
            <div className="row" style={{justifyContent:"space-between"}}>
              <strong>{n.title}</strong>
              {n.ack_required && <span className="badge P1">Requires Acknowledgement</span>}
            </div>
            <p style={{margin:".25rem 0"}}>{n.body}</p>
            <button className={n.ack_required ? "btn" : "btn ghost"} onClick={()=>read.mutate(n.id)}>
              {n.ack_required ? "Acknowledge" : "Mark as read"}
            </button>
          </div>
        )) : <p className="muted">All caught up.</p>}
      </div>

      <div className="card" style={{textAlign:"center"}}>
        <button className="btn danger" style={{width:"100%",padding:"1rem",fontSize:"1.1rem"}}
          onClick={()=>{ if (confirm("Send P1 panic alert?")) panic.mutate(); }}>
          🚨 Panic — Send P1 alert
        </button>
      </div>

      <p className="muted" style={{textAlign:"center"}}>Upcoming duties: {duties.data?.length ?? 0}</p>
    </div>
  );
}
