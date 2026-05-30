import { Routes, Route, Navigate, NavLink, useNavigate } from "react-router-dom";
import { clearSession, getMe } from "./lib/api";
import Login from "./pages/Login";
import LiveMap from "./pages/LiveMap";
import History from "./pages/History";
import Roster from "./pages/Roster";
import RoutesAdmin from "./pages/RoutesAdmin";
import Incidents from "./pages/Incidents";
import Notices from "./pages/Notices";
import Driver from "./pages/Driver";

function Shell({ children }: { children: React.ReactNode }) {
  const me = getMe(); const nav = useNavigate();
  if (!me) return <Navigate to="/login" replace />;
  const link = (to:string, label:string) =>
    <NavLink to={to} className={({isActive})=>isActive?"active":""}>{label}</NavLink>;
  return (
    <div className="app">
      <nav className="nav">
        <strong style={{color:"var(--accent)"}}>NCRTC BMS</strong>
        {me.role !== "driver" && link("/map","Live Map")}
        {me.role !== "driver" && link("/history","History")}
        {(me.role==="admin"||me.role==="manager") && link("/roster","Roster")}
        {me.role==="admin" && link("/routes","Routes")}
        {me.role !== "driver" && link("/incidents","Incidents")}
        {link("/notices","Notices")}
        {me.role==="driver" && link("/driver","Driver")}
        <span className="spacer" />
        <span className="muted">{me.full_name} · {me.role}</span>
        <button className="btn ghost" onClick={()=>{ clearSession(); nav("/login"); }}>Logout</button>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const me = getMe();
  return (
    <Routes>
      <Route path="/login" element={<Login/>} />
      <Route path="/" element={<Navigate to={me?.role==="driver"?"/driver":"/map"} replace />} />
      <Route path="/map" element={<Shell><LiveMap/></Shell>} />
      <Route path="/history" element={<Shell><History/></Shell>} />
      <Route path="/roster" element={<Shell><Roster/></Shell>} />
      <Route path="/routes" element={<Shell><RoutesAdmin/></Shell>} />
      <Route path="/incidents" element={<Shell><Incidents/></Shell>} />
      <Route path="/notices" element={<Shell><Notices/></Shell>} />
      <Route path="/driver" element={<Shell><Driver/></Shell>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
