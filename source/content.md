# [Jacob Metoyer](https://github.com/Jacob-Met)

## Research software for the work between data and a decision.

I study computer science and physics at Cal State Long Beach, with a minor in biology, and I’m preparing for MD/PhD training. Those education and training details are self-reported ([public profile](https://github.com/Jacob-Met)).

I build tools for difficult handoffs: recording a research session, keeping evidence beside a check, or making a simulated decision reviewable before anything changes. My public work includes [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md), [CanvasPilot](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md), [TowerOps](https://github.com/Jacob-Met/TowerOps/blob/main/README.md), and [workflow-checks](https://github.com/Jacob-Met/workflow-checks). Each project links to its source and states what its demo does not establish.

## Research tools, built to inspect.

### [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)

CaptureSuite is a Windows-first platform for multimodal research capture. A daemon owns session timing and state; versioned C++ and Python workers connect individual devices; the session is sealed into a package for quality checks and analysis ([project scope](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

The repository includes a simulator and a Lab Streaming Layer bridge for running without vendor hardware. Its [quality-control demo](https://github.com/Jacob-Met/CaptureSuite/blob/main/tools/demo_qc.py) uses generated data; it is not a hardware benchmark or evidence of clinical validity ([documented limits](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

### [CanvasPilot](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)

CanvasPilot gives Canvas LMS a command-line and MCP interface. A local browser-session broker can bridge API gaps where schools disable API tokens; the repository describes the implementation, not a verified live school login or student outcome ([project scope](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

The [offline demo](https://github.com/Jacob-Met/canvaspilot/blob/main/src/canvaspilot/offline_demo.py) runs on synthetic fixtures without a Canvas account. It does not validate real school authentication or student results ([documented limits](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

### [TowerOps](https://github.com/Jacob-Met/TowerOps/blob/main/README.md)

TowerOps is a synthetic air-traffic decision-support demo. Before its simulated state changes, deterministic checks project conflicts, check freshness, require approval, and verify readback; it is not operational ATC software and is not connected to aircraft ([project scope](https://github.com/Jacob-Met/TowerOps/blob/main/README.md); [demo code](https://github.com/Jacob-Met/TowerOps/blob/main/demo.py)).

## Workflow checks: synthetic records, visible evidence.

[workflow-checks](https://github.com/Jacob-Met/workflow-checks) contains three Python standard-library demos for utility bills, freight billing, and physical-therapy authorizations. The records are generated; the [README](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md) describes scope and limits, and the [sample outputs](https://jacobmetoyer.com/workflow-checks/) can be inspected directly.

### [Utility bills](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)

The demo flags records such as mismatched payments, duplicate bills, overlapping service periods, missing bills, and unusual usage. It keeps the source rows with each check and queues clean unpaid bills for human approval; it does not issue payments ([utility demo](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).

[See the generated sample](https://jacobmetoyer.com/workflow-checks/) · [Inspect the code](https://github.com/Jacob-Met/workflow-checks/tree/main/utility_watch)

### [Freight packets](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)

The freight demo drafts detention packets and invoice flags with calculations and evidence timelines. Missing or uncertain tracking evidence is held for a person; nothing is sent or invoiced ([freight demo](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)).

[See the generated sample](https://jacobmetoyer.com/workflow-checks/) · [Inspect the code](https://github.com/Jacob-Met/workflow-checks/tree/main/freight_packets)

### [PT authorizations](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)

The PT demo turns synthetic authorizations and visits into a prioritized worklist with reason codes, submit-by dates, and payer checklists. The patients are invented and payer rules are placeholders; it does not submit anything ([PT demo](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)).

[See the generated sample](https://jacobmetoyer.com/workflow-checks/) · [Inspect the code](https://github.com/Jacob-Met/workflow-checks/tree/main/pt_auth)

## A scoped pilot starts with a baseline.

If a workflow-checks pilot makes sense, start with redacted exports, the rules actually in use, and a manual review baseline. Compare only that period and dataset, then limit any claim to the measured result; the synthetic demos are not evidence of savings or accuracy on someone else’s data ([pilot scope](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md); [utility requirements](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).
