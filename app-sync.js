  const ready = () => !!(config.url && config.anonKey && session?.access_token && state.team?.id);

  async function api(path, options={}) {
    if(!config.url||!config.anonKey) throw new Error("Supabase is not configured");
    const response=await fetch(`${config.url.replace(/\/$/,"")}${path}`,{
      ...options,
      headers:{
        apikey:config.anonKey,
        Authorization:`Bearer ${config.anonKey}`,
        "Content-Type":"application/json",
        ...(options.headers||{})
      }
    });
    const text=await response.text();
    if(!response.ok){
      let message=text||`Request failed: ${response.status}`;
      try{const parsed=JSON.parse(text);message=parsed.message||parsed.error_description||parsed.error||message;}catch{}
      throw new Error(message);
    }
    return text?JSON.parse(text):null;
  }

  const rpc=(name,body)=>api(`/rest/v1/rpc/${name}`,{method:"POST",body:JSON.stringify(body)});
  const normalizeRpcRow=data=>Array.isArray(data)?data[0]:data;

  async function ensureAnonymousSession(){ return true; }
  function captureEmailSession(){ return false; }
  async function fetchUser(){ return null; }
  async function signOut(){
    session=null;
    state.team=null;
    localStorage.removeItem(SESSION);
    save();
    toast("Device disconnected from team");
  }

  async function upsert(table,item){
    if(!ready()){
      toast("Saved on this phone. Join a team to sync.");
      return false;
    }
    const functionName={
      trips:"upsert_trip_pin",
      riders:"upsert_rider_pin",
      availability:"upsert_availability_pin"
    }[table];
    if(!functionName)return false;
    try{
      await rpc(functionName,{p_access_token:session.access_token,p_item:item});
      return true;
    }catch(error){
      console.error(error);
      toast("Saved on this phone; sync will retry");
      return false;
    }
  }

  async function remoteDelete(table,id){
    if(!ready())return;
    try{
      await rpc("delete_team_item_pin",{p_access_token:session.access_token,p_table:table,p_id:id});
    }catch(error){
      console.error(error);
      toast("Deleted locally; remote delete will need retry");
    }
  }

  function mergeRemoteWithLocal(remoteRows,localRows){
    const remote=Array.isArray(remoteRows)?remoteRows:[];
    const local=Array.isArray(localRows)?localRows:[];
    const merged=new Map(remote.map(row=>[row.id,row]));
    for(const row of local){if(row?.id&&!merged.has(row.id))merged.set(row.id,row);}
    return [...merged.values()];
  }

  async function retryUnsynced(table,localRows,remoteRows){
    const remoteIds=new Set((Array.isArray(remoteRows)?remoteRows:[]).map(row=>row.id));
    for(const row of (Array.isArray(localRows)?localRows:[])){
      if(row?.id&&!remoteIds.has(row.id))await upsert(table,row);
    }
  }

  async function loadRemote(){
    if(!ready())return;
    try{
      const localTrips=[...state.trips],localRiders=[...state.riders],localAvailability=[...state.availability];
      const board=normalizeRpcRow(await rpc("get_team_board",{p_access_token:session.access_token}))||{};
      const trips=Array.isArray(board.trips)?board.trips:[];
      const riders=Array.isArray(board.riders)?board.riders:[];
      const availability=Array.isArray(board.availability)?board.availability:[];
      state.team=board.team||state.team;
      state.trips=mergeRemoteWithLocal(trips,localTrips);
      state.riders=mergeRemoteWithLocal(riders,localRiders);
      state.availability=mergeRemoteWithLocal(availability,localAvailability);
      if(Array.isArray(board.roster)&&board.roster.length){
        state.roster=[...new Set([...state.roster,...board.roster.filter(Boolean)])].sort();
      }
      save();
      await retryUnsynced("trips",localTrips,trips);
      await retryUnsynced("riders",localRiders,riders);
      await retryUnsynced("availability",localAvailability,availability);
    }catch(error){
      console.error(error);
      if(/Invalid device token/i.test(error.message||"")){
        session=null;state.team=null;localStorage.removeItem(SESSION);save();
        $("teamMessage").textContent="This device connection expired. Rejoin using the team code and PIN.";
      }else toast("Offline copy preserved; sync will retry");
    }
  }

  async function resolveTeam(){ if(ready())await loadRemote(); }

  async function createTeam(){
    const name=$("teamName").value.trim();
    const display=$("displayName").value.trim();
    const pin=$("teamPin")?.value.trim()||"";
    if(!name||!display)return toast("Enter your display name and team name");
    if(!/^\d{6}$/.test(pin))return toast("Choose a 6-digit team PIN");
    try{
      const row=normalizeRpcRow(await rpc("create_team_pin",{p_name:name,p_display_name:display,p_pin:pin}));
      if(!row?.access_token)throw new Error("No device token returned");
      session={access_token:row.access_token};
      localStorage.setItem(SESSION,JSON.stringify(session));
      state.team={id:row.team_id,name:row.team_name,join_code:row.team_code};
      if(!state.roster.includes(display))state.roster.push(display);
      save();
      for(const trip of state.trips)await upsert("trips",trip);
      for(const rider of state.riders)await upsert("riders",rider);
      for(const entry of state.availability)await upsert("availability",entry);
      $("teamMessage").textContent=`Team created. Code: ${row.team_code}. Share the code and PIN with your team.`;
      toast(`Team code: ${row.team_code}`);
    }catch(error){
      console.error(error);
      $("teamMessage").textContent=error.message||"Could not create team.";
    }
  }

  async function joinTeam(){
    const code=$("joinCode").value.trim().toUpperCase();
    const display=$("displayName").value.trim();
    const pin=$("joinPin")?.value.trim()||"";
    if(!code||!display)return toast("Enter your display name and team code");
    if(!/^\d{6}$/.test(pin))return toast("Enter the 6-digit team PIN");
    try{
      const row=normalizeRpcRow(await rpc("join_team_pin",{p_team_code:code,p_display_name:display,p_pin:pin}));
      if(!row?.access_token)throw new Error("No device token returned");
      session={access_token:row.access_token};
      localStorage.setItem(SESSION,JSON.stringify(session));
      state.team={id:row.team_id,name:row.team_name,join_code:row.team_code};
      if(!state.roster.includes(display))state.roster.push(display);
      save();
      await loadRemote();
      $("teamMessage").textContent=`Connected to ${row.team_name}.`;
      toast("Joined team");
    }catch(error){
      console.error(error);
      $("teamMessage").textContent=error.message||"Could not join team. Verify the code and PIN.";
    }
  }

  async function sendEmailLink(){ return toast("Email sign-in is no longer required"); }
