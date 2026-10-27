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
a("spire-of-octaves","Spire of Octaves",W,"An original fiction world: stories, the Spire, and the long works.",demo="https://spireofoctaves.com/",thumb="spire-of-octaves.webp",flag=True)
a("towerops","TowerOps",W,"An air-traffic-control conflict-awareness demo where bounded AI agents flag converging aircraft on a live radar view — built in a weekend with Strands Agents.",demo=J+"/TowerOps/airspace/",repo="TowerOps",thumb="towerops-desktop.webp")
a("afterimage","afterimage",Pe,"Reconstruct what probably happened from fragments of real media, and learn which observation to make next.",thumb="afterimage.webp",flag=True)
a("chronos-vision","chronos-vision",Pe,"Watches ordinary video and forecasts where every object in the scene is going next — and which constraints will change.",thumb="chronos-vision.webp",flag=True)
a("mechanism","mechanism",Pe,"Recovers the joints, linkages and working dynamics of real machinery from nothing but a video of it moving.",thumb="mechanism.webp")
a("synapse","synapse",Pe,"A spatial environment for exploring and manipulating real running computational systems in XR.")
a("materialtruth","materialtruth",Pe,"Surface-defect and material inspection using controlled multi-illumination imagery.")
a("phantom-window","Phantom Window",Pe,"Turns flat phone video into a window you can look around: estimated depth, tracked camera, cinematic parallax and novel views.",thumb="phantom-window.webp")
a("replay-forge","Replay Forge",Pe,"Rebuilds a real basketball play in 3D from game footage, then lets you branch the replay and ask what-if — every frame tied back to source video.",thumb="replay-forge.webp",flag=True)
a("domino","Domino",Pe,"A causal digital twin for smart-home automations: reconstruct event chains, expose rule conflicts and timing races, and prove fixes by replay.",thumb="domino.webp")
a("captionverse","Captionverse",Ac,"Captions placed in space beside whoever is speaking, with directional sound cues — accessibility that tells you who and where, not just what.",thumb="captionverse.webp")
a("threshold","Threshold",Ac,"Accessibility-focused visitor awareness and interaction around a doorbell camera.")
a("familiar-memories","Familiar Memories",Ac,"Recognize a visiting relative and surface relevant family photos, subject to consent.")
a("recallweave","RecallWeave",Ac,"Browser-only adaptive learning toolkit: transparent Bayesian learner, interactive labs, lesson authoring.",demo=J+"/RecallWeave/explore.html",repo="RecallWeave",thumb="recallweave-desktop.webp",hack="ForgeHacks 2026")
a("hamon-model-research","Hamon model research",R,"Agent-driven research into models, representations, synthesis and cluster-native learning algorithms.")
a("hamon-memory-research","Hamon memory research",R,"Research prototypes for evolving agent memory, stdlib-only Python with a small Rust compute core.")
a("pneumatic-mri-sim","Pneumatic MRI sim",R,"Deterministic Rust experiments with a reduced-order pneumatic MRI-guided surgical-robot control stack.")
a("surgical-ergonomics","Surgical ergonomics",R,"Surgeon pose tracking and a realtime demo for the Soangra Lab at UCI.")
a("canvaspilot","CanvasPilot",T,"Agentic Canvas LMS tooling: MCP + CLI, a stay-open SSO session broker, structured Canvas REST tools.",repo="canvaspilot")
a("capturesuite","CaptureSuite",T,"Windows-first multimodal research capture: daemon, versioned worker plugins, sealed sessions, PySide6 operator UI.",repo="CaptureSuite")
a("workflow-checks","workflow-checks",T,"Evidence-first back-office checks on synthetic data: freight detention, invoice audit, PT authorization, utility exceptions.",demo=J+"/workflow-checks/",repo="workflow-checks",thumb="workflow-checks.webp")
a("ledgerly","Ledgerly",T,"Agentic invoice and payout copilot for freelancers with a human approval gate.",demo=J+"/ledgerly/",repo="ledgerly",thumb="ledgerly.webp",hack="PayPal AI Hackathon")
a("tastetable","TasteTable",T,"Agentic weekly dining and outing planner for seniors and caregivers, grounded in Qloo taste signals.",demo=J+"/tastetable/",repo="tastetable",thumb="tastetable.webp",hack="Qloo Agentic Hackathon")
a("testpilot","testpilot",T,"An agent that writes, runs and repairs regression tests for a diff.",repo="testpilot",hack="Nebius x NVIDIA Global AI Hackathon")
a("scopesignal","ScopeSignal",T,"Evidence-backed milestone checkout with deterministic PayPal Sandbox replay.",demo=J+"/scopesignal/",repo="scopesignal",thumb="scopesignal.webp")
for p in P:
  if p["thumbnail"] and p["thumbnail"].startswith("/assets/demos/../"): p["thumbnail"]="/assets/"+p["thumbnail"][len("/assets/demos/../"):]
RANK=['wildside', 'hamon-engine', 'afterimage', 'replay-forge', 'chronos-vision', 'spire-of-octaves', 'mechanism', 'phantom-window', 'captionverse', 'domino', 'synapse', 'materialtruth', 'hamon-model-research', 'tastetable', 'ledgerly', 'recallweave', 'pneumatic-mri-sim', 'towerops', 'hamon-memory-research', 'surgical-ergonomics', 'threshold', 'familiar-memories', 'scopesignal', 'workflow-checks', 'capturesuite', 'canvaspilot', 'testpilot']
MS={"towerops":"First hackathon submission ever · Sept 2026","wildside":"First in-person hackathon"}
for p in P: p["rank"]=RANK.index(p["slug"])+1; p["milestone"]=MS.get(p["slug"])
P.sort(key=lambda p:p["rank"])
json.dump({"updated":"2026-10-27","groups":[W,Pe,Ac,R,T],"projects":P},open("docs/projects.json","w"),indent=1)
print(len(P))
