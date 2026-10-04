# [Jacob Metoyer](https://github.com/Jacob-Met)

## I build the tools I wish my research already had.

I'm an undergraduate at Cal State Long Beach studying computer science and physics, with a minor in biology, on the road to MD/PhD training ([my GitHub profile](https://github.com/Jacob-Met); the MD/PhD goal is self-reported).

Most of my time goes into research software: [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md), a capture platform for motion and physiological data, and the [timing model](https://github.com/Jacob-Met/CaptureSuite/blob/main/docs/design/TIMING.md) that keeps its streams honest with each other. Everything below is public, so you can read the code instead of taking my word for it ([scope and limits](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

## Projects

### [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)

A Windows-first capture system for multimodal research: a daemon, worker plugins, and sealed session packages so a recording stays intact after it leaves the lab ([project scope](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

You can try the quality-control demo with no hardware at all. It runs on synthetic data, so it shows the pipeline, not real-world performance ([demo code](https://github.com/Jacob-Met/CaptureSuite/blob/main/tools/demo_qc.py); [limits](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

### [CanvasPilot](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)

An MCP server and command-line tool for Canvas LMS, plus a small local broker that can borrow a browser session when the API won't do ([project scope](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

The offline demo is synthetic and needs no Canvas account ([demo code](https://github.com/Jacob-Met/canvaspilot/blob/main/src/canvaspilot/offline_demo.py); [limits](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

### [TowerOps](https://github.com/Jacob-Met/TowerOps/blob/main/README.md)

A simulation of air-traffic decision support where deterministic gates have to pass before anything changes state. It's a toy world, not real ATC, and it never touches an aircraft ([project scope](https://github.com/Jacob-Met/TowerOps/blob/main/README.md); [demo code](https://github.com/Jacob-Met/TowerOps/blob/main/demo.py)).

## Workflow checks

Outside the lab I've been writing [workflow-checks](https://github.com/Jacob-Met/workflow-checks): three small standard-library Python programs that read messy billing paperwork and tell a person where to look. They run on made-up data, so the [sample outputs](https://jacobmetoyer.com/workflow-checks/) are demos, and the [README](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md) has the details.

### [Utility bills](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)

Flags billing exceptions and lines up the clean, unpaid bills for someone to approve, each with its evidence rows. It never pays anything ([utility demo](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).

[See a sample](https://jacobmetoyer.com/workflow-checks/) · [Read the code](https://github.com/Jacob-Met/workflow-checks/tree/main/utility_watch)

### [Freight packets](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)

Drafts detention packets with the calculation and an evidence timeline, and flags invoice problems. Anything missing or uncertain goes to a human, and nothing is sent or invoiced ([freight demo](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)).

[See a sample](https://jacobmetoyer.com/workflow-checks/) · [Read the code](https://github.com/Jacob-Met/workflow-checks/tree/main/freight_packets)

### [PT authorizations](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)

Turns authorizations and visits into one prioritized worklist with submit-by dates and checklists. The patients are invented and the payer rules are placeholders; nothing is submitted ([PT demo](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)).

[See a sample](https://jacobmetoyer.com/workflow-checks/) · [Read the code](https://github.com/Jacob-Met/workflow-checks/tree/main/pt_auth)

## Want to try one on your paperwork?

I'd start small: a redacted export, your real rules, and a manual pass to compare against. Whatever it's worth would come from that comparison for your data, not from my demos ([how a pilot would work](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md); [utility requirements](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).
