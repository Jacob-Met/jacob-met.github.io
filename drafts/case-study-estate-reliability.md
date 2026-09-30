<!--
DRAFT — NOT PUBLISHED. Not linked from the built site; source/build.py does not read drafts/.
Evidence below comes from the estate's private repo docs and live goal-store queries (2026-09-30).
Before publication: (1) Jacob reads and approves the wording; (2) each figure either gets a public
evidence link or stays explicitly labelled "from private logs"; (3) the site's source-link rule
(content.json) is satisfied or this stays a standalone note.
-->

# Running a small fleet of AI agents on one laptop: what broke, what we measured

*Draft case study, 2026-09-30. Figures come from the system's own logs and tests, with the scope of each
one stated. No client work, customer names or credentials are involved.*

## The setup

Three long-running AI agents share one laptop-class Linux host. Each unit of work is a **goal** with a
recorded owner, attempt, model turns and host effects. Over two days (2026-09-29 and 2026-09-30) the
goal store recorded **1,606 goals**. By end of day on 09-30: 1,062 completed, 266 failed, 214 ended as
`outcome_unknown`, 30 stopped and 34 still running.

One rule shaped everything below. If the process that owns a goal dies mid-attempt, the goal becomes
`outcome_unknown`. It is never silently marked done or re-run. A successor must inspect what actually
happened before doing anything again. Three findings came out of working under that rule.

## 1. A restore check that would have discarded finished work

**What we tested.** An isolated drill restored a real backup snapshot into a scratch directory. It then
killed a simulated goal owner and reconciled the dead attempt in a fresh process. It never touched live
state.

**What it found.** A fault-injection case made the live store hold a stale "still running" row for a goal
that the snapshot recorded as completed. The restore planner answered `keep_live`, which would have
silently thrown away the completed outcome. After the fix, that case returns `manual_data_cut`: both
versions are kept and a person or agent has to compare them. The planner refuses to overwrite either one
automatically.

**Numbers.** The test failed as expected before the fix. After it, 47 tests ran: 46 passed and 1 was
skipped because a backup tool wasn't installed in the test sandbox. A read-only plan against a real
earlier restore verified 7 databases, 59 files and 48 artifacts. It found 332 goals and 4,342 goal
events newer in live state than in the snapshot, and it correctly kept live state.

**Limits.** This is not a measured production recovery time and not a full host reboot. The 23.65 ms
reconciliation timing is from a fixture child process, not the host.

## 2. Software releases were orphaning work, and then they weren't

**Before.** A release waited for "no goals running" before restarting. With 7–35 goals usually in flight,
that moment never came. New goals sat queued for 32–44 minutes. When the 45-minute wait ran out, a forced
restart killed a goal 74 model turns in.

**Change.** The server now runs as *generations* under a stable launcher. A release starts a new
generation beside the old one. The old generation stops taking work, finishes its own running attempts
and exits by itself. A goal is marked `outcome_unknown` only when its owner generation's lock is free,
which means that process is actually dead.

**A bug found in the process.** The retiring generation kept its listening socket open while it finished
work. The kernel kept sending it about half of the new connections, and nothing accepted them. In a
measured run with real processes, 48 of 88 health requests timed out before the fix and 0 of 23,588
after it.

**Audit.** An independent audit of one release window covered 15 rolling activations. It found **zero
orphaned goals** caused by those activations, even though live goals crossed each cutover. The orphans
that did occur in that window came from manual service restarts outside the release path. A separate
gateway restart also disconnected five model turns.

**Limits.** "Zero orphans" applies to those 15 activations only. The 214 `outcome_unknown` goals over the
two days have other causes: manual restarts, gateway interruptions, deliberate owner-kill exercises and
dead attempts. Not every one has been attributed yet.

## 3. Checking which model actually answered

Agents can request a model by name, but a request isn't proof of what served it. Since 17:05Z on
2026-09-30, every served model turn records the model identity that the gateway's response reported,
next to the model that was requested.

**Numbers (17:05Z–22:44Z, 2026-09-30):** 10,640 served turns across five model routes:

| Requested | Reported by gateway | Turns |
|---|---|---|
| GPT-6 Sol | GPT-6 Sol | 3,715 |
| GPT-6 Luna | GPT-6 Luna | 2,593 |
| Claude Sonnet 5.5 | Claude Sonnet 5.5 | 2,271 |
| Claude Opus 5.5 | Claude Opus 5.5 | 2,053 |
| GPT-6.1 Sol | GPT-6.1 Sol | 8 |

The requested and reported identities agreed on every recorded turn.

**Limits.** This is the identity the gateway put in its response, not an identity attested by the
upstream provider. The window covers about 5.7 hours. Turns that the provider refused aren't counted
here. Those are logged separately as decline records, with `served_model: null` and no guessed identity.

## What generalizes

- Treating "unknown" as its own state is cheap, and it made each of these problems visible.
- The drain-based release design failed because of queueing math (the system is never idle), not because
  of a coding mistake. Measuring the actual concurrency first would have ruled it out.
- Log what was requested and what served it as separate fields, and state how strong the evidence is.

---
*Sources (private, available on request):* estate docs `recovery-drill-2026-09-29.md`,
`rolling-releases.md`, `rolling-release.md`, `incident-recovery-playbook.md` and `decline-record.md`,
plus read-only goal-store queries on 2026-09-30 ~22:45Z.
