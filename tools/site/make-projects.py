import json
J="https://jacobmetoyer.com"; G="https://github.com/Jacob-Met/"
P=[]
def a(slug,title,group,line,demo=None,repo=None,video=None,thumb=None,flag=False,scope=None,hack=None):
    st="live" if demo else ("demo-video" if video or thumb else "private-source")
    P.append(dict(slug=slug,title=title,group=group,oneLiner=line,status=st,sourcePublic=bool(repo),
      links={k:v for k,v in dict(demo=demo,repo=G+repo if repo else None,video=video,hackathon=hack).items() if v},
      thumbnail=f"/assets/demos/{thumb}" if thumb else None,flagship=flag,scope=scope))
W,Pe,Ac,R,T="Worlds & games","Perception & physical AI","Accessibility & care","Research instruments","Tools"
a("wildside","Wildside",W,"A painted nature game that turns real places into living, explorable worlds — ecology, weather and wildlife rendered in a hand-painted style in the browser.",demo=J+"/wildside/",thumb="../wildside/wildside-hero.webp",flag=True,scope="Browser build; the painted view targets WebGPU with a WebGL fallback.")
a("hamon-engine","Hamon Engine",W,"A Rust + wgpu game engine built for agent control: typed ECS commands, deterministic replay, native and browser targets.",demo=J+"/hamon.html",thumb="../hamon/hamon-share.jpg",flag=True)
a("spire-of-octaves","Spire of Octaves",W,"A vertical world of cities stacked on cities — go down to be born, go up to be remembered. Thirty-seven free stories across nine heights of the Spire, from the boiler-row Clans of Geargrave to the brine courts of the Salt Scriptoria, plus serials, a short novel on Royal Road, and a game in progress on the Hamon Engine.",demo="https://spireofoctaves.com/",thumb="spire-of-octaves.webp",flag=True)
a("towerops","TowerOps",W,"An air-traffic-control conflict-awareness demo where bounded AI agents flag converging aircraft on a live radar view — built in a weekend with Strands Agents.",demo=J+"/TowerOps/airspace/",repo="TowerOps",thumb="towerops-desktop.webp")
a("afterimage","afterimage",Pe,"Hand it scraps — a blurry clip, a few photos, a partial log — and it reconstructs what most likely happened, then tells you which single observation would settle the rest.",thumb="afterimage.webp",flag=True)
a("chronos-vision","chronos-vision",Pe,"Watches ordinary video and forecasts where every object in the scene is going next — and which constraints will change.",thumb="chronos-vision.webp",flag=True)
a("mechanism","mechanism",Pe,"Recovers the joints, linkages and working dynamics of real machinery from nothing but a video of it moving.",thumb="mechanism.webp")
a("synapse","synapse",Pe,"Walk around inside a live, running software system in XR — see processes and data move, reach in and change them.")
a("materialtruth","materialtruth",Pe,"Lights a part from many controlled angles and reads the surface back, catching scratches and defects a single photo misses.")
a("phantom-window","Phantom Window",Pe,"Turns flat phone video into a window you can look around: estimated depth, tracked camera, cinematic parallax and novel views.",thumb="phantom-window.webp")
a("replay-forge","Replay Forge",Pe,"Rebuilds a real basketball play in 3D from game footage, then lets you branch the replay and ask what-if — every frame tied back to source video.",thumb="replay-forge.webp",flag=True)
a("domino","Domino",Pe,"A causal digital twin for smart-home automations: reconstruct event chains, expose rule conflicts and timing races, and prove fixes by replay.",thumb="domino.webp")
a("captionverse","Captionverse",Ac,"Captions placed in space beside whoever is speaking, with directional sound cues — accessibility that tells you who and where, not just what.",thumb="captionverse.webp")
a("threshold","Threshold",Ac,"A doorbell that works for people who can't easily hear, see or reach the door: who's there, what they want, and a way to answer.")
a("familiar-memories","Familiar Memories",Ac,"When a relative visits, it recognizes them and brings up the photos you share — with consent and revocation built in, for families living with memory loss.")
a("recallweave","RecallWeave",Ac,"Browser-only adaptive learning toolkit: transparent Bayesian learner, interactive labs, lesson authoring.",demo=J+"/RecallWeave/explore.html",repo="RecallWeave",thumb="recallweave-desktop.webp",hack="ForgeHacks 2026")
a("hamon-model-research","Hamon model research",R,"Agents running real experiments on new model architectures, representations and learning algorithms designed for clusters from the start.")
a("hamon-memory-research","Hamon memory research",R,"How should an agent decide what to remember, revise or forget? Working prototypes, Python with a Rust core.")
a("pneumatic-mri-sim","Pneumatic MRI sim",R,"A deterministic Rust simulation of the control stack for an air-driven surgical robot that works inside an MRI scanner.")
a("surgical-ergonomics","Surgical ergonomics",R,"Tracking surgeons' posture, muscle load and heart rate during procedures, with a realtime demo — built for the Soangra Lab at UCI.")
a("canvaspilot","CanvasPilot",T,"Agentic Canvas LMS tooling: MCP + CLI, a stay-open SSO session broker, structured Canvas REST tools.",repo="canvaspilot")
a("capturesuite","CaptureSuite",T,"Windows-first multimodal research capture: daemon, versioned worker plugins, sealed sessions, PySide6 operator UI.",repo="CaptureSuite")
a("workflow-checks","workflow-checks",T,"Evidence-first back-office checks on synthetic data: freight detention, invoice audit, PT authorization, utility exceptions.",demo=J+"/workflow-checks/",repo="workflow-checks",thumb="workflow-checks.webp")
a("ledgerly","Ledgerly",T,"Agentic invoice and payout copilot for freelancers with a human approval gate.",demo=J+"/ledgerly/",repo="ledgerly",thumb="ledgerly.webp",hack="PayPal AI Hackathon")
a("tastetable","TasteTable",T,"Agentic weekly dining and outing planner for seniors and caregivers, grounded in Qloo taste signals.",demo=J+"/tastetable/",repo="tastetable",thumb="tastetable.webp",hack="Qloo Agentic Hackathon")
a("testpilot","testpilot",T,"Give it a code change; it writes the regression tests, runs them, and fixes the ones that break. Nebius × NVIDIA hackathon entry.",repo="testpilot",hack="Nebius x NVIDIA Global AI Hackathon")
a("scopesignal","ScopeSignal",T,"Evidence-backed milestone checkout with deterministic PayPal Sandbox replay.",demo=J+"/scopesignal/",repo="scopesignal",thumb="scopesignal.webp")
for p in P:
  if p["thumbnail"] and p["thumbnail"].startswith("/assets/demos/../"): p["thumbnail"]="/assets/"+p["thumbnail"][len("/assets/demos/../"):]
RANK=['wildside', 'hamon-engine', 'afterimage', 'replay-forge', 'chronos-vision', 'spire-of-octaves', 'mechanism', 'phantom-window', 'captionverse', 'domino', 'synapse', 'materialtruth', 'hamon-model-research', 'tastetable', 'ledgerly', 'recallweave', 'pneumatic-mri-sim', 'towerops', 'hamon-memory-research', 'surgical-ergonomics', 'threshold', 'familiar-memories', 'scopesignal', 'workflow-checks', 'capturesuite', 'canvaspilot', 'testpilot']
MS={"towerops":"First hackathon submission ever · Sept 2026","wildside":"First in-person hackathon"}
for p in P: p["rank"]=RANK.index(p["slug"])+1; p["milestone"]=MS.get(p["slug"])
P.sort(key=lambda p:p["rank"])
json.dump({"updated":"2026-10-27","groups":[W,Pe,Ac,R,T],"projects":P},open("docs/projects.json","w"),indent=1)
print(len(P))
