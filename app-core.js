"use strict";

  const STORE = "meps-state-v2", CONFIG = "meps-config-v1", SESSION = "meps-session-v1";
  const empty = () => ({ trips: [], riders: [], availability: [], roster: ["Team Member 1", "Team Member 2", "Team Member 3", "Team Member 4"], team: null });
  const $ = id => document.getElementById(id);
  const $$ = q => [...document.querySelectorAll(q)];
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };
  let state = read(STORE, empty()), config = read(CONFIG, { url: "", anonKey: "" }), session = read(SESSION, null), installPrompt;

  const save = () => { localStorage.setItem(STORE, JSON.stringify(state)); render(); };
  const uuid = () => crypto.randomUUID?.() || `id-${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtDate = d => d ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(`${d}T12:00:00`)) : "No date";
  const toast = text => { $("toast").textContent = text; $("toast").classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => $("toast").classList.remove("show"), 2400); };
  const nav = view => { $$(".view").forEach(x => x.classList.toggle("active", x.id === `view-${view}`)); $$(".nav-item").forEach(x => x.classList.toggle("active", x.dataset.nav === view)); scrollTo({ top: 0, behavior: "smooth" }); };
  const tripRiders = id => state.riders.filter(r => r.trip_id === id && r.status !== "Canceled");

  function conflict(t) {
    const count = tripRiders(t.id).length, seats = Number(t.seat_capacity || 0);
    if (!t.primary_driver) return "Assign a primary coordinator.";
    if (t.primary_driver === t.backup_driver) return "Primary and backup cannot be the same person.";
    if (seats && count > seats) return `Over capacity by ${count - seats} seat(s).`;
    if (state.trips.some(x => x.id !== t.id && x.date === t.date && x.window === t.window && x.primary_driver === t.primary_driver && x.status !== "Canceled")) return `${t.primary_driver} is double-booked.`;
    if (state.availability.some(a => a.date === t.date && a.member_name.toLowerCase() === t.primary_driver.toLowerCase() && a.status === "Unavailable")) return `${t.primary_driver} is marked unavailable.`;
    return "";
  }

  function renderBoard() {
    const list = $("tripList"), date = $("filterDate").value, status = $("filterStatus").value;
    const trips = [...state.trips].filter(t => (!date || t.date === date) && (!status || t.status === status)).sort((a,b) => `${a.date}${a.departure_time}`.localeCompare(`${b.date}${b.departure_time}`));
    const riders = state.riders.filter(r => r.status !== "Canceled").length;
    const open = state.trips.reduce((n,t) => n + Math.max(0, Number(t.seat_capacity || 0) - tripRiders(t.id).length), 0);
    const issues = state.trips.filter(conflict).length;
    $("boardSummary").textContent = `${state.trips.length} trip(s) • ${riders} rider(s) • ${open} open seat(s)${issues ? ` • ${issues} need action` : ""}`;
    list.innerHTML = "";
    for (const t of trips) {
      const f = $("tripCardTemplate").content.cloneNode(true), count = tripRiders(t.id).length, seats = Number(t.seat_capacity || 0), left = seats - count, alert = conflict(t);
      f.querySelector(".trip-date").textContent = `${fmtDate(t.date)} • ${t.window}`;
      f.querySelector(".trip-title").textContent = `${t.meps_location} — ${t.pickup_area}`;
      const badge = f.querySelector(".trip-status"); badge.textContent = t.status; badge.classList.add(t.status.replace(/\s/g,""));
      f.querySelector(".trip-primary").textContent = t.primary_driver || "Unassigned";
      f.querySelector(".trip-backup").textContent = t.backup_driver || "Not assigned";
      f.querySelector(".trip-vehicle").textContent = t.vehicle || "Not assigned";
      f.querySelector(".trip-time").textContent = t.departure_time || "Not set";
      if (alert) { f.querySelector(".trip-alert").textContent = alert; f.querySelector(".trip-alert").classList.remove("hidden"); }
      f.querySelector(".seat-text").textContent = `${count} rider(s) • ${Math.abs(left)} ${left >= 0 ? "open" : "over"} • ${seats} total`;
      const meter = f.querySelector(".meter span"); meter.style.width = `${seats ? Math.min(100, count / seats * 100) : 0}%`; if (left < 0) meter.style.background = "var(--red)";
      f.querySelector(".edit-trip").onclick = () => editTrip(t.id);
      f.querySelector(".add-rider").onclick = () => { openRider(t.id); nav("riders"); };
      f.querySelector(".delete-trip").onclick = () => removeTrip(t.id);
      list.append(f);
    }
    $("emptyBoard").classList.toggle("hidden", trips.length > 0);
  }

  function renderRiders() {
    $("riderList").innerHTML = state.riders.map(r => {
      const t = state.trips.find(x => x.id === r.trip_id);
      return `<article class="card list-card"><div class="list-card-header"><div><p class="meta">${esc(t ? `${fmtDate(t.date)} • ${t.meps_location}` : "Trip not found")}</p><h3 class="list-card-title">${esc(r.applicant_ref)}</h3></div><span class="pill ${esc(r.status)}">${esc(r.status)}</span></div><div class="meta">${esc(r.recruiter)} • ${esc(r.appointment_type)} • Pickup: ${esc(r.pickup_location || "Not set")}</div><div class="inline-actions"><button class="button ghost" data-edit-rider="${r.id}">Edit</button><button class="button danger" data-delete-rider="${r.id}">Delete</button></div></article>`;
    }).join("");
    $("emptyRiders").classList.toggle("hidden", state.riders.length > 0);
    $$('[data-edit-rider]').forEach(b => b.onclick = () => openRider("", b.dataset.editRider));
    $$('[data-delete-rider]').forEach(b => b.onclick = () => removeRow("riders", b.dataset.deleteRider));
    fillTrips();
  }

  function renderAvailability() {
    const rows = [...state.availability].sort((a,b) => `${a.date}${a.member_name}`.localeCompare(`${b.date}${b.member_name}`));
    $("availabilityList").innerHTML = rows.map(a => `<article class="card list-card"><div class="list-card-header"><div><p class="meta">${fmtDate(a.date)}</p><h3 class="list-card-title">${esc(a.member_name)}</h3></div><span class="pill ${a.status === "Unavailable" ? "Canceled" : a.status === "Preferred" ? "Confirmed" : "Planned"}">${esc(a.status)}</span></div><div class="meta">${a.has_vehicle ? `Vehicle • ${a.seat_capacity || 0} seats` : "No vehicle"}${a.notes ? ` • ${esc(a.notes)}` : ""}</div><div class="inline-actions"><button class="button ghost" data-edit-avail="${a.id}">Edit</button><button class="button danger" data-delete-avail="${a.id}">Delete</button></div></article>`).join("");
    $("emptyAvailability").classList.toggle("hidden", rows.length > 0);
    $$('[data-edit-avail]').forEach(b => b.onclick = () => openAvailability(b.dataset.editAvail));
    $$('[data-delete-avail]').forEach(b => b.onclick = () => removeRow("availability", b.dataset.deleteAvail));
  }

  function renderSettings() {
    $("rosterInput").value = state.roster.join("\n");
    $("rosterOptions").innerHTML = state.roster.map(n => `<option value="${esc(n)}"></option>`).join("");
    $("supabaseUrl").value = config.url || ""; $("supabaseKey").value = config.anonKey || "";
    const signed = !!session?.access_token;
    const pendingEmail = sessionStorage.getItem("meps-pending-email");
    $("signOut").classList.toggle("hidden", !signed); $("sendEmailLink").classList.toggle("hidden", signed); $("authEmail").disabled = signed;
    $("authMessage").textContent = signed
      ? `Signed in as ${session.user?.email || "authorized user"}.`
      : pendingEmail ? `Verification email sent to ${pendingEmail}. Open the link on this device.` : "";
    $("syncBadge").textContent = state.team && signed ? "Synced" : config.url ? "Ready" : "Local";
    $("syncBadge").className = `status-badge ${state.team && signed ? "online" : "offline"}`;
    $("teamMessage").textContent = state.team ? `Team: ${state.team.name} • Join code: ${state.team.join_code || "hidden"}` : "";
  }

  const render = () => { renderBoard(); renderRiders(); renderAvailability(); renderSettings(); };

  function resetTrip() { $("tripForm").reset(); $("tripId").value = ""; $("tripDate").value = today(); $("tripSeats").value = 7; $("tripStatus").value = "Planned"; $("tripTitle").textContent = "New trip"; }
  function editTrip(id) { const t = state.trips.find(x => x.id === id); if (!t) return; for (const [k,v] of Object.entries({ tripId:t.id, tripDate:t.date, tripWindow:t.window, tripMeps:t.meps_location, tripPickup:t.pickup_area, tripDeparture:t.departure_time, tripReturn:t.return_eta, tripPrimary:t.primary_driver, tripBackup:t.backup_driver, tripVehicle:t.vehicle, tripSeats:t.seat_capacity, tripStatus:t.status, tripNotes:t.notes })) $(k).value = v ?? ""; $("tripTitle").textContent = "Edit trip"; nav("trip"); }
  async function removeTrip(id) { if (!confirm("Delete this trip and its riders?")) return; state.trips = state.trips.filter(x => x.id !== id); state.riders = state.riders.filter(x => x.trip_id !== id); save(); await remoteDelete("trips", id); toast("Trip deleted"); }

  function fillTrips() { const current = $("riderTrip").value; $("riderTrip").innerHTML = `<option value="">Select trip</option>${[...state.trips].filter(t => t.status !== "Canceled").sort((a,b)=>a.date.localeCompare(b.date)).map(t => `<option value="${t.id}">${esc(`${fmtDate(t.date)} • ${t.window} • ${t.meps_location}`)}</option>`).join("")}`; if ([...$("riderTrip").options].some(o => o.value === current)) $("riderTrip").value = current; }
  function openRider(tripId="", id="") { $("riderForm").classList.remove("hidden"); $("riderForm").reset(); $("riderId").value=""; fillTrips(); $("riderTrip").value=tripId; const r=state.riders.find(x=>x.id===id); if(r){ $("riderId").value=r.id; $("riderTrip").value=r.trip_id; $("riderRef").value=r.applicant_ref; $("riderRecruiter").value=r.recruiter; $("riderPickup").value=r.pickup_location||""; $("riderAppointment").value=r.appointment_type; $("riderHotel").value=r.hotel_needed?"Yes":"No"; $("riderStatus").value=r.status; $("riderNotes").value=r.notes||""; } $("riderForm").scrollIntoView({behavior:"smooth"}); }
  function openAvailability(id="") { $("availabilityForm").classList.remove("hidden"); $("availabilityForm").reset(); $("availabilityId").value=""; $("availabilityDate").value=today(); const a=state.availability.find(x=>x.id===id); if(a){ $("availabilityId").value=a.id; $("availabilityDate").value=a.date; $("availabilityMember").value=a.member_name; $("availabilityStatus").value=a.status; $("availabilityVehicle").value=a.has_vehicle?"Yes":"No"; $("availabilitySeats").value=a.seat_capacity||""; $("availabilityNotes").value=a.notes||""; } $("availabilityForm").scrollIntoView({behavior:"smooth"}); }
  async function removeRow(table,id){ if(!confirm("Delete this entry?")) return; state[table]=state[table].filter(x=>x.id!==id); save(); await remoteDelete(table,id); toast("Deleted"); }

