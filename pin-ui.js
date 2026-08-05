"use strict";

(() => {
  const authCard=document.getElementById("authCard");
  if(authCard)authCard.classList.add("hidden");

  const teamCard=document.getElementById("teamCard");
  if(!teamCard)return;

  const oldIntro=teamCard.querySelector(".anonymous-intro");
  if(oldIntro)oldIntro.remove();

  const intro=document.createElement("div");
  intro.className="settings-copy pin-intro";
  intro.innerHTML="<strong>Team code + PIN</strong><p>No account needed. Create a team once, then share its 8-character code and 6-digit PIN with the team.</p>";
  teamCard.prepend(intro);

  const teamName=document.getElementById("teamName");
  const createButton=document.getElementById("createTeam");
  const joinCode=document.getElementById("joinCode");
  const joinButton=document.getElementById("joinTeam");

  const createPinLabel=document.createElement("label");
  createPinLabel.innerHTML='<span>Choose team PIN</span><input id="teamPin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="6 digits" />';
  teamName.closest("label").after(createPinLabel);

  const joinPinLabel=document.createElement("label");
  joinPinLabel.innerHTML='<span>Team PIN</span><input id="joinPin" type="password" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="6 digits" />';
  joinCode.closest("label").after(joinPinLabel);

  createButton.textContent="Create team and code";
  joinButton.textContent="Join with code and PIN";
  joinCode.maxLength=8;
  joinCode.placeholder="8-character code";

  for(const id of ["teamPin","joinPin"]){
    const input=document.getElementById(id);
    input.addEventListener("input",()=>{input.value=input.value.replace(/\D/g,"").slice(0,6);});
  }

  const disconnect=document.createElement("button");
  disconnect.id="disconnectTeam";
  disconnect.type="button";
  disconnect.className="button danger hidden";
  disconnect.textContent="Disconnect this device";
  disconnect.addEventListener("click",()=>{
    if(!confirm("Disconnect this device from the team? Shared trips will remain in the team board."))return;
    signOut();
  });
  teamCard.appendChild(disconnect);

  const previousRenderSettings=renderSettings;
  renderSettings=function renderPinSettings(){
    previousRenderSettings();
    const connected=ready();
    disconnect.classList.toggle("hidden",!connected);
    createButton.classList.toggle("hidden",connected);
    joinButton.classList.toggle("hidden",connected);
    teamName.closest("label").classList.toggle("hidden",connected);
    createPinLabel.classList.toggle("hidden",connected);
    joinCode.closest("label").classList.toggle("hidden",connected);
    joinPinLabel.classList.toggle("hidden",connected);
    document.getElementById("syncBadge").textContent=connected?"Synced":"Ready";
    document.getElementById("syncBadge").className=`status-badge ${connected?"online":"offline"}`;
    if(connected&&state.team){
      document.getElementById("teamMessage").textContent=`Team: ${state.team.name} • Code: ${state.team.join_code}`;
    }
  };

  renderSettings();
})();
