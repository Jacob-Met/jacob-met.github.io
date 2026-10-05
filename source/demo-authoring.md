# Demo publishing pattern — commercial and contest work

This repository serves the existing GitHub Pages site for `jacobmetoyer.com` from `main:/docs`. New demos are static routes in that site; do not create another host, account, paid service, or deployment target.

## Route and source ownership

- Use a lane-qualified route: `demos/commercial/<target-slug>/` for one commercial target, or `demos/contests/<event-slug>/` for one named contest. Never reuse a target's data or a contest entry's visual identity for another.
- Keep the source under `source/demos/<lane>/<slug>/`: `data.json` (synthetic fixtures only), `index.html` (static accessible shell), `ui.ts` (browser interactions), `ui.css` (page-specific visuals), and focused tests. Add the route metadata and source revision to the gallery manifest. `docs/` is generated; never edit it by hand.
- Make the demo answer one concrete question for that audience. Design the visible workflow for the real target/event, not a generic dashboard; include at least one meaningful interaction, a clear evidence/detail view, empty/error states, and a purposeful mobile layout.

## Safety and truth bar

- Use only invented names, identifiers, files, dates, and amounts. Label the scenario and every data surface as synthetic. Do not include prospect exports, private correspondence, real bids, Canvas data, unpublished research, or credentials.
- Bundle the fixture with the page. No backend, fetch/XHR, remote fonts/scripts/images, analytics, storage, account sign-in, uploads, messages, email, payments, entry submission, or hidden tracking. Enforce this with `connect-src 'none'`, local-only CSP, and the site checker.
- State what each signal means and its known limitations. A checklist is not a score; a comparison is not a recommendation; a contest prototype is not proof of eligibility or a winning result. Keep human approval at consequential decisions.
- Link the exact public source/revision and the relevant README/rules. For a contest, read current rules first and satisfy permitted tools, disclosure, license, attribution, and AI-use requirements before rendering or publishing. For commercial work, qualify the target separately; a demo does not authorize contact or an offer.

## Verify and publish

1. Confirm current owner/claims and do not edit another lane's files. Record `Language:` and `Reason:`; browser UI is TypeScript. Keep each demo in its own source directory and branch/commit.
2. Run `npm test`, `python -m unittest discover -s source -v`, build `docs/`, then `python source/check.py docs`. Review generated output, scope labels, URLs, and the manifest; test keyboard use and reduced motion.
3. After a fresh host-capacity read, render every changed route in a real browser on an available GL63 or Raider worker. Check desktop and narrow/mobile viewports, controls, console/page errors, failed requests, CSP, and horizontal overflow. Keep work off the Mac until relay fix `da543fb7` is independently read back.
4. Push the tested branch to the existing GitHub repository. Read back the exact branch/head and required checks; publish to `main:/docs` only after the real-browser review passes. Verify the deployed routes and record their exact URLs, source commit, and time.

## Per-demo brief template

```text
Lane and slug:
Audience / one question:
Current source owner and branch:
Synthetic scenario + snapshot date:
Interaction and evidence shown:
Claims deliberately not made:
Rules/README/source revision:
Language: TypeScript. Reason: browser interactions and local fixture only.
Required route: /demos/<lane>/<slug>/
Browser, host, viewport, console/network result:
```
