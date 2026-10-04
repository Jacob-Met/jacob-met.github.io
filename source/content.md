# [Jacob Metoyer](https://github.com/Jacob-Met)

## Research first. Receipts for everything.

I am an undergraduate at Cal State Long Beach (computer science and physics, minor in biology) preparing for MD/PhD training ([profile on GitHub](https://github.com/Jacob-Met); MD/PhD goal and background are self-reported).

My research work is open to inspect: [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md), a multimodal research capture platform for motion and physiological data, with a design note on [its timing model](https://github.com/Jacob-Met/CaptureSuite/blob/main/docs/design/TIMING.md).

Public repositories and dated snapshots back what is written here. Synthetic demos say so on their face, and nothing here claims clinical validity or client results ([documented limits](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

## Research software and projects. Open it up.

### [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)

Windows-first multimodal research capture: daemon, worker plugins, sealed session packages ([project scope](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

The offline QC demo uses synthetic data and needs no hardware; it does not establish hardware performance or clinical validity ([demo code](https://github.com/Jacob-Met/CaptureSuite/blob/main/tools/demo_qc.py); [documented limits](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

### [CanvasPilot](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)

Canvas LMS MCP server and CLI, with a local broker that can use a browser session ([project scope](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

The offline demo is synthetic and needs no live Canvas access; it does not validate school authentication or student outcomes ([demo code](https://github.com/Jacob-Met/canvaspilot/blob/main/src/canvaspilot/offline_demo.py); [documented limits](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

### [TowerOps](https://github.com/Jacob-Met/TowerOps/blob/main/README.md)

Synthetic air-traffic decision support, with deterministic gates before a simulated transition. Not operational ATC. Not connected to aircraft ([project scope](https://github.com/Jacob-Met/TowerOps/blob/main/README.md); [demo code](https://github.com/Jacob-Met/TowerOps/blob/main/demo.py)).

## Workflow checks: a side project, synthetic demos

Separate from the research above: I also build [workflow-checks](https://github.com/Jacob-Met/workflow-checks), three Python standard-library demos for utility bills, freight billing, and PT authorizations. Synthetic data; not deployed for clients; no real-world savings or accuracy claimed. [All sample outputs at jacobmetoyer.com/workflow-checks](https://jacobmetoyer.com/workflow-checks/) · [Code and scope](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md).

### [Utility bills](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)

Billing exceptions flagged; clean unpaid bills queued for approval, with evidence rows. No payments issued ([utility demo](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).

[Inspect the sample output](https://jacobmetoyer.com/workflow-checks/) · [Inspect the utility code](https://github.com/Jacob-Met/workflow-checks/tree/main/utility_watch)

### [Freight packets](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)

Draft detention packets, invoice flags, calculations, and evidence timelines. Missing or uncertain evidence goes to a person; nothing is sent or invoiced ([freight demo](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)).

[Inspect the sample output](https://jacobmetoyer.com/workflow-checks/) · [Inspect the freight code](https://github.com/Jacob-Met/workflow-checks/tree/main/freight_packets)

### [PT authorizations](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)

A prioritized authorization and visit worklist, with submit-by dates and checklists. Synthetic patients, placeholder payer rules; nothing submitted ([PT demo](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)).

[Inspect the sample output](https://jacobmetoyer.com/workflow-checks/) · [Inspect the PT code](https://github.com/Jacob-Met/workflow-checks/tree/main/pt_auth)

## Workflow-checks pilots: start small. Measure before claiming.

Interested in a scoped pilot? Start with redacted exports, real rules, and a manual audit baseline; limit any claims to the measured comparison for that client and period ([pilot scope](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md); [utility requirements](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).
