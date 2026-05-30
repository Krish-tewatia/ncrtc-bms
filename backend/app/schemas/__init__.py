from datetime import datetime, date
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict

class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# auth
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    full_name: str

class UserOut(ORM):
    id: int; username: str; full_name: str; role: str; depot_id: Optional[int] = None

# depot/vehicle/route
class DepotOut(ORM):
    id: int; name: str; lat: float; lng: float

class VehicleOut(ORM):
    id: int; reg_no: str; depot_id: int; status: str

class StopIn(BaseModel):
    seq: int; name: str; lat: float; lng: float; planned_time: str

class StopOut(StopIn, ORM):
    id: int

class RouteIn(BaseModel):
    name: str; depot_id: int; stops: list[StopIn]

class RouteOut(ORM):
    id: int; name: str; depot_id: int
    stops: list[StopOut] = []

# duty
class DutyIn(BaseModel):
    date: date; driver_id: int; vehicle_id: int; route_id: int; depot_id: int

class DutyOut(ORM):
    id: int; date: date; driver_id: int; vehicle_id: int; route_id: int
    depot_id: int; published: bool; acknowledged: bool

# gps
class PingOut(ORM):
    vehicle_id: int; ts: datetime; lat: float; lng: float; speed_kmh: float; heading: float

class LiveVehicle(BaseModel):
    vehicle_id: int; reg_no: str; depot_id: int
    lat: float; lng: float; speed_kmh: float; ts: datetime

class LiveVehicleDetail(BaseModel):
    vehicle_id: int
    reg_no: str
    driver_name: Optional[str]
    route_name: Optional[str]
    recent_pings: list[PingOut]

# incident
class IncidentIn(BaseModel):
    type: str; severity: str; description: str = ""
    depot_id: Optional[int] = None; vehicle_id: Optional[int] = None
    photo: Optional[str] = None

class IncidentEventOut(ORM):
    id: int; ts: datetime; actor_id: int
    from_status: Optional[str]; to_status: str; note: str

class IncidentOut(ORM):
    id: int; type: str; severity: str; status: str; description: str
    photo: Optional[str] = None
    depot_id: Optional[int]; vehicle_id: Optional[int]
    reporter_id: int; assignee_id: Optional[int]; created_at: datetime
    events: list[IncidentEventOut] = []

class IncidentUpdate(BaseModel):
    to_status: Optional[str] = None
    assignee_id: Optional[int] = None
    note: str = ""

# notice
class NoticeIn(BaseModel):
    title: str; body: str; audience: dict[str, Any]
    ack_required: bool = False
    publish_at: Optional[datetime] = None

class NoticeOut(ORM):
    id: int; title: str; body: str; audience: dict
    ack_required: bool
    publish_at: datetime; created_by: int
