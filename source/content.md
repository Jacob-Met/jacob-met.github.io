# [Jacob Metoyer](https://github.com/Jacob-Met)

## I build the tools I wish my research already had.

I study computer science and physics at Cal State Long Beach, with a minor in biology. I'm working toward MD/PhD training. [More about me](https://github.com/Jacob-Met).

I'm interested in what happens between a useful idea and a tool someone can actually use. Lately that's meant [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md): recording motion and physiological data, then making sure the [timing](https://github.com/Jacob-Met/CaptureSuite/blob/main/docs/design/TIMING.md) lines up. The projects below are open to explore. Their READMEs explain what's working and what's still being built ([scope and limits](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

## Projects

### [CaptureSuite](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)

When several sensors record the same experiment, keeping their data together is its own problem. I'm building CaptureSuite around that: Windows recording tools, plugins for different streams, and a session package that travels with the recording ([project scope](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

The [quality-control demo](https://github.com/Jacob-Met/CaptureSuite/blob/main/tools/demo_qc.py) walks through a generated recording; no hardware needed. It's a way to explore the pipeline, not a performance benchmark ([limits](https://github.com/Jacob-Met/CaptureSuite/blob/main/README.md)).

### [CanvasPilot](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)

Canvas has useful information spread across a lot of screens. CanvasPilot gives it a command-line and MCP interface, with a local browser-session bridge for gaps in the API ([project scope](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

The offline demo is synthetic and needs no Canvas account ([demo code](https://github.com/Jacob-Met/canvaspilot/blob/main/src/canvaspilot/offline_demo.py); [limits](https://github.com/Jacob-Met/canvaspilot/blob/main/README.md)).

### [TowerOps](https://github.com/Jacob-Met/TowerOps/blob/main/README.md)

A small air-traffic simulation for exploring a simple question: what should a system check before it acts? TowerOps makes those checks explicit. It's a toy environment, not an operational ATC system ([project scope](https://github.com/Jacob-Met/TowerOps/blob/main/README.md); [demo code](https://github.com/Jacob-Met/TowerOps/blob/main/demo.py)).

## Workflow checks

I also built [workflow-checks](https://github.com/Jacob-Met/workflow-checks) for the little things that get buried in paperwork: a utility bill that looks off, a freight charge worth checking, or a PT authorization deadline. Three small Python programs, each with a [sample you can explore](https://jacobmetoyer.com/workflow-checks/). The records are made up; the [README](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md) explains how the demos work.

### [Utility bills](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)

See which bills need a closer look and which are ready for approval, with the supporting rows beside them. Review only; it doesn't issue payments ([utility demo](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).

[See a sample](https://jacobmetoyer.com/workflow-checks/) · [Read the code](https://github.com/Jacob-Met/workflow-checks/tree/main/utility_watch)

### [Freight packets](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)

Pull the calculation, timeline and missing details into a detention packet someone can review. It prepares a draft, not an invoice or an outbound message ([freight demo](https://github.com/Jacob-Met/workflow-checks/blob/main/freight_packets/README.md)).

[See a sample](https://jacobmetoyer.com/workflow-checks/) · [Read the code](https://github.com/Jacob-Met/workflow-checks/tree/main/freight_packets)

### [PT authorizations](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)

Put authorizations, visits and upcoming deadlines in one worklist. The sample uses invented patients and placeholder payer rules; it doesn't submit anything ([PT demo](https://github.com/Jacob-Met/workflow-checks/blob/main/pt_auth/README.md)).

[See a sample](https://jacobmetoyer.com/workflow-checks/) · [Read the code](https://github.com/Jacob-Met/workflow-checks/tree/main/pt_auth)

## Want to try one on your paperwork?

Let's start with one small, redacted export and the rules you actually use. We can compare its output with a manual review, see where it helps, and fix where it doesn't. The demos aren't evidence of savings on your data ([how a pilot would work](https://github.com/Jacob-Met/workflow-checks/blob/main/README.md); [utility requirements](https://github.com/Jacob-Met/workflow-checks/blob/main/utility_watch/README.md)).
