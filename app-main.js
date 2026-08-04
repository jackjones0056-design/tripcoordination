  $("tripForm").onsubmit=async e=>{e.preventDefault();const id=$("tripId").value||uuid(),t={id,date:$("tripDate").value,window:$("tripWindow").value,meps_location:$("tripMeps").value,pickup_area:$("tripPickup").value.trim(),departure_time:$("tripDeparture").value,return_eta:$("tripReturn").value,primary_driver:$("tripPrimary").value.trim(),backup_driver:$("tripBackup").value.trim(),vehicle:$("tripVehicle").value.trim(),seat_capacity:Number($("tripSeats").value),status:$("tripStatus").value,notes:$("tripNotes").value.trim()};const i=state.trips.findIndex(x=>x.id===id);i>=0?state.trips[i]=t:state.trips.push(t);[t.primary_driver,t.backup_driver].filter(Boolean).forEach(n=>{if(!state.roster.includes(n))state.roster.push(n)});save();await upsert("trips",t);resetTrip();nav("board");toast("Trip saved");};
  $("riderForm").onsubmit=async e=>{e.preventDefault();const id=$("riderId").value||uuid(),r={id,trip_id:$("riderTrip").value,applicant_ref:$("riderRef").value.trim(),recruiter:$("riderRecruiter").value.trim(),pickup_location:$("riderPickup").value.trim(),appointment_type:$("riderAppointment").value,hotel_needed:$("riderHotel").value==="Yes",status:$("riderStatus").value,notes:$("riderNotes").value.trim()};const i=state.riders.findIndex(x=>x.id===id);i>=0?state.riders[i]=r:state.riders.push(r);save();await upsert("riders",r);$("riderForm").classList.add("hidden");toast("Rider saved");};
  $("availabilityForm").onsubmit=async e=>{e.preventDefault();const id=$("availabilityId").value||uuid(),a={id,date:$("availabilityDate").value,member_name:$("availabilityMember").value.trim(),status:$("availabilityStatus").value,has_vehicle:$("availabilityVehicle").value==="Yes",seat_capacity:Number($("availabilitySeats").value||0),notes:$("availabilityNotes").value.trim()};const i=state.availability.findIndex(x=>x.id===id);i>=0?state.availability[i]=a:state.availability.push(a);if(a.member_name&&!state.roster.includes(a.member_name))state.roster.push(a.member_name);save();await upsert("availability",a);$("availabilityForm").classList.add("hidden");toast("Availability saved");};

  $$('[data-nav]').forEach(b=>b.onclick=()=>{if(b.dataset.nav==="trip")resetTrip();nav(b.dataset.nav)});
  $("clearFilters").onclick=()=>{$("filterDate").value="";$("filterStatus").value="";renderBoard()}; $("filterDate").onchange=renderBoard; $("filterStatus").onchange=renderBoard;
  $("newRiderBtn").onclick=()=>openRider(); $("cancelRider").onclick=()=>$("riderForm").classList.add("hidden");
  $("newAvailabilityBtn").onclick=()=>openAvailability(); $("cancelAvailability").onclick=()=>$("availabilityForm").classList.add("hidden");
  $("saveRoster").onclick=()=>{state.roster=$("rosterInput").value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);save();toast("Roster saved")};
  $("saveSupabase").onclick=()=>{config={url:$("supabaseUrl").value.trim(),anonKey:$("supabaseKey").value.trim()};localStorage.setItem(CONFIG,JSON.stringify(config));renderSettings();toast("Connection saved")};
  $("createTeam").onclick=async()=>{try{await ensureAnonymousSession();await createTeam();}catch{toast("Could not connect this device")}};
  $("joinTeam").onclick=async()=>{try{await ensureAnonymousSession();await joinTeam();}catch{toast("Could not connect this device")}};
  $("exportData").onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=u;a.download=`meps-backup-${today()}.json`;a.click();URL.revokeObjectURL(u)};
  $("importData").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);if(!Array.isArray(d.trips)||!Array.isArray(d.riders))throw 0;state={...empty(),...d};save();toast("Backup imported")}catch{toast("Invalid backup file")}};r.readAsText(f)};
  $("clearLocalData").onclick=()=>{if(confirm("Clear all local data?")){state=empty();save();toast("Local data cleared")}};
  addEventListener("beforeinstallprompt",e=>{e.preventDefault();installPrompt=e;$("installBtn").classList.remove("hidden")}); $("installBtn").onclick=async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;$("installBtn").classList.add("hidden")}};
  addEventListener("online",()=>ready()?loadRemote():ensureAnonymousSession().catch(()=>{})); addEventListener("offline",renderSettings);

  if("serviceWorker" in navigator){
    let reloading=false;
    navigator.serviceWorker.addEventListener("controllerchange",()=>{
      if(reloading)return;
      reloading=true;
      location.reload();
    });
    addEventListener("load",async()=>{
      try{
        const registration=await navigator.serviceWorker.register("./service-worker.js?v=ios-20260804-5",{updateViaCache:"none"});
        await registration.update();
        if(registration.waiting)registration.waiting.postMessage({type:"SKIP_WAITING"});
        registration.addEventListener("updatefound",()=>{
          const worker=registration.installing;
          if(!worker)return;
          worker.addEventListener("statechange",()=>{
            if(worker.state==="installed"&&navigator.serviceWorker.controller)worker.postMessage({type:"SKIP_WAITING"});
          });
        });
      }catch(error){console.error("Service worker update failed",error);}
    });
  }

  (async()=>{
    const capturedSession=captureEmailSession();
    try{
      if(capturedSession||session?.access_token){await fetchUser();await resolveTeam();}
      else {await ensureAnonymousSession();await fetchUser();await resolveTeam();}
    }catch(error){console.error(error);}
  })();
  setInterval(()=>{if(document.visibilityState==="visible"&&ready()&&navigator.onLine)loadRemote()},30000);
  resetTrip(); $("availabilityDate").value=today(); render();
