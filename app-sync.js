  const ready = () => !!(config.url && config.anonKey && session?.access_token && state.team?.id);
  async function refreshSession() {
    if (!session?.refresh_token) throw new Error("Session expired");
    const r = await fetch(`${config.url.replace(/\/$/,"")}/auth/v1/token?grant_type=refresh_token`, { method:"POST", headers:{ apikey:config.anonKey, "Content-Type":"application/json" }, body:JSON.stringify({refresh_token:session.refresh_token}) });
    if(!r.ok) throw new Error("Session refresh failed"); const data=await r.json(); session={...session,...data,expires_at:Date.now()+Number(data.expires_in||3600)*1000}; localStorage.setItem(SESSION,JSON.stringify(session)); return session;
  }
  async function api(path, options={}, retry=true) {
    if(!config.url||!config.anonKey) throw new Error("Supabase is not configured");
    const r=await fetch(`${config.url.replace(/\/$/,"")}${path}`, {...options,headers:{apikey:config.anonKey,Authorization:`Bearer ${session?.access_token||config.anonKey}`,"Content-Type":"application/json",Prefer:options.prefer||"return=representation",...(options.headers||{})}});
    if(r.status===401&&retry&&session?.refresh_token){ await refreshSession(); return api(path,options,false); }
    if(!r.ok) throw new Error(await r.text()||`Request failed: ${r.status}`); if(r.status===204)return null; const text=await r.text(); return text?JSON.parse(text):null;
  }
  async function upsert(table,item){
    if(!ready())return false;
    try{
      await api(`/rest/v1/${table}?on_conflict=id`,{method:"POST",body:JSON.stringify({...item,team_id:state.team.id}),prefer:"resolution=merge-duplicates,return=representation"});
      return true;
    }catch(e){
      console.error(e);
      toast("Saved on this phone; sync will retry");
      return false;
    }
  }
  async function remoteDelete(table,id){ if(!ready())return; try{await api(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&team_id=eq.${state.team.id}`,{method:"DELETE"});}catch(e){console.error(e);} }

  function mergeRemoteWithLocal(remoteRows, localRows){
    const remote = Array.isArray(remoteRows) ? remoteRows : [];
    const local = Array.isArray(localRows) ? localRows : [];
    const merged = new Map(remote.map(row => [row.id, row]));
    for(const row of local){
      if(row?.id && !merged.has(row.id)) merged.set(row.id, row);
    }
    return [...merged.values()];
  }

  async function retryUnsynced(table, localRows, remoteRows){
    const remoteIds = new Set((Array.isArray(remoteRows) ? remoteRows : []).map(row => row.id));
    const unsynced = (Array.isArray(localRows) ? localRows : []).filter(row => row?.id && !remoteIds.has(row.id));
    for(const row of unsynced) await upsert(table,row);
  }

  async function loadRemote(){
    if(!ready())return;
    try{
      const localTrips=[...state.trips], localRiders=[...state.riders], localAvailability=[...state.availability];
      const [trips,riders,availability,members]=await Promise.all([
        api(`/rest/v1/trips?team_id=eq.${state.team.id}&select=*&order=date.asc`),
        api(`/rest/v1/riders?team_id=eq.${state.team.id}&select=*`),
        api(`/rest/v1/availability?team_id=eq.${state.team.id}&select=*&order=date.asc`),
        api(`/rest/v1/team_members?team_id=eq.${state.team.id}&select=display_name`)
      ]);

      state.trips=mergeRemoteWithLocal(trips,localTrips);
      state.riders=mergeRemoteWithLocal(riders,localRiders);
      state.availability=mergeRemoteWithLocal(availability,localAvailability);
      const names=(members||[]).map(x=>x.display_name).filter(Boolean);
      if(names.length)state.roster=[...new Set([...state.roster,...names])].sort();
      save();

      await retryUnsynced("trips",localTrips,trips);
      await retryUnsynced("riders",localRiders,riders);
      await retryUnsynced("availability",localAvailability,availability);
    }catch(e){
      console.error(e);
      toast("Offline copy preserved; sync will retry");
    }
  }
  async function resolveTeam(){ if(!session?.access_token)return; try{const m=await api("/rest/v1/team_members?select=team_id,display_name,teams(id,name,join_code)&limit=1");if(m?.length){state.team=m[0].teams||{id:m[0].team_id,name:"Team"};if(m[0].display_name&&!state.roster.includes(m[0].display_name))state.roster.push(m[0].display_name);save();await loadRemote();}}catch(e){console.error(e);} }

  const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
  async function sendEmailLink(){
    const email=$("authEmail").value.trim().toLowerCase();
    if(!validEmail(email))return toast("Enter a valid email address");
    const redirectTo=new URL("./",location.href).href;
    try{
      await api(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`,{method:"POST",body:JSON.stringify({email,create_user:true})});
      sessionStorage.setItem("meps-pending-email",email);
      $("authEmail").value=email;
      $("authMessage").textContent=`Verification email sent to ${email}. Open the link on this device.`;
      toast("Verification email sent");
    }catch(e){
      console.error(e);
      $("authMessage").textContent="Could not send the verification email. Check the email provider and rate limits.";
    }
  }
  function captureEmailSession(){
    const params=new URLSearchParams(location.hash.replace(/^#/,""));
    const error=params.get("error_description")||params.get("error");
    if(error){
      history.replaceState({},document.title,location.pathname+location.search);
      $("authMessage").textContent=decodeURIComponent(error.replace(/\+/g," "));
      return false;
    }
    const accessToken=params.get("access_token");
    if(!accessToken)return false;
    session={
      access_token:accessToken,
      refresh_token:params.get("refresh_token"),
      expires_at:Date.now()+Number(params.get("expires_in")||3600)*1000,
      user:null
    };
    localStorage.setItem(SESSION,JSON.stringify(session));
    sessionStorage.removeItem("meps-pending-email");
    history.replaceState({},document.title,location.pathname+location.search);
    return true;
  }
  async function fetchUser(){if(!session?.access_token)return;try{session.user=await api("/auth/v1/user");localStorage.setItem(SESSION,JSON.stringify(session));renderSettings();}catch(e){console.error(e);} }
  async function signOut(){try{if(session?.access_token)await api("/auth/v1/logout",{method:"POST"});}catch{}session=null;state.team=null;sessionStorage.removeItem("meps-pending-email");localStorage.removeItem(SESSION);save();toast("Signed out");}
  async function createTeam(){const name=$("teamName").value.trim(),display=$("displayName").value.trim();if(!session?.access_token)return toast("Sign in first");if(!name||!display)return toast("Enter team and display names");try{const d=await api("/rest/v1/rpc/create_team",{method:"POST",body:JSON.stringify({p_name:name,p_display_name:display})});const r=Array.isArray(d)?d[0]:d;state.team={id:r.team_id,name,join_code:r.join_code};if(!state.roster.includes(display))state.roster.push(display);save();for(const t of state.trips)await upsert("trips",t);for(const r of state.riders)await upsert("riders",r);for(const a of state.availability)await upsert("availability",a);toast(`Team created: ${r.join_code}`);}catch(e){console.error(e);$("teamMessage").textContent="Could not create team. Confirm the SQL schema is installed.";} }
  async function joinTeam(){const code=$("joinCode").value.trim().toUpperCase(),display=$("displayName").value.trim();if(!session?.access_token)return toast("Sign in first");if(!code||!display)return toast("Enter display name and join code");try{const d=await api("/rest/v1/rpc/join_team",{method:"POST",body:JSON.stringify({p_join_code:code,p_display_name:display})});const r=Array.isArray(d)?d[0]:d;state.team={id:r.team_id,name:r.team_name,join_code:code};save();await loadRemote();toast("Joined team");}catch(e){console.error(e);$("teamMessage").textContent="Could not join team. Verify the code.";} }

