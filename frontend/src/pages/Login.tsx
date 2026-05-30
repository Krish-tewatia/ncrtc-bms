import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../lib/api";

export default function Login() {
  const [u,setU]=useState("admin"); const [p,setP]=useState("password");
  const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const nav=useNavigate();
  async function submit(e: React.FormEvent){ e.preventDefault(); setBusy(true); setErr("");
    try { const me = await login(u,p); nav(me.role==="driver"?"/driver":"/map"); }
    catch(e:any){ setErr(e.message); } finally{ setBusy(false); } }
  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h2 style={{marginTop:0,color:"var(--accent)"}}>NCRTC BMS</h2>
        <p className="muted">Demo logins (password: <code>password</code>): <b>admin</b>, <b>manager1</b>, <b>ops1</b>, <b>driver1</b></p>
        <label>Username</label><input value={u} onChange={e=>setU(e.target.value)} />
        <label>Password</label><input type="password" value={p} onChange={e=>setP(e.target.value)} />
        {err && <p style={{color:"var(--danger)"}}>{err}</p>}
        <button className="btn" disabled={busy} style={{marginTop:"1rem",width:"100%"}}>{busy?"…":"Sign in"}</button>
      </form>
    </div>
  );
}
