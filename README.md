# Learning to Fly

Learning to Fly is a reading game for autistic children. It is a local-first web app: it works offline, installs to a home screen, and keeps every answer on the device. On the live site, a signed-in family also gets a private cloud copy, so a learner carries on from any device.

**[The research behind Learning to Fly](https://dweissenborn.github.io/learning_to_fly/)** sets out every study the design rests on, what the app does with each one, and where the evidence is thin.

The learner starts on Home Island and builds it up: each finished session adds one thing to it, and three paths across the island light up as skills are mastered.

- **Harbor Town** is reading to do: signs, steps, timetables, labels, messages, on-screen prompts.
- **Story Woods** is reading to follow a story: who, where and when, order, causes, pronouns, feelings, main idea.
- **Lantern Peaks** is reading to think about life. It stays "coming up" until the gate in the plan opens.

Every finished session also moves the learner along a journey: the ferry to Gull Island, Windy Cape, Cloud Hill Airfield, take-off in a small red plane called the Kookaburra, and finally Australia to visit the koalas. Small clues appear on the island and after each session. Along the way there are setbacks: a storm, a blocked path, a broken propeller, strong winds. Each is explained, comes with a calm coping line and a choice of plan, and never costs anything. The journey moves with finished sessions, never with scores; a grown-up can set its pace or turn setbacks off.

Pacing follows the learner, who is quick once he sees what a task asks:

- **Harder texts are earned.** Each skill has five text levels. Two first-try answers in a row move him up a level; two misses step him down. Levels 4 and 5 (longer, multi-paragraph, up to about grade 8) appear only once he climbs to them.
- **No re-teaching.** The worked example shows only until he has solved an item on that skill himself. Guided practice drops out once he works the skill independently, and he gets more of his own items instead.
- **Fast track.** One flawless session (with a new format and a level 3 or harder text) can master a skill. Reviews at 3, 7 and 21 days still check that it lasts. An adult can turn this off.

The grown-ups' area reports the school's current goals (main idea, key details, problem-solving) on their own, so they can be shared with his teacher.

Engagement is watched and answered, from timing alone (nothing he types):

- **Activity logging.** Each session records the steps he reaches, pauses of 45 seconds or more, when the app is put away, and demo skips.
- **What it tells the grown-ups.** The Activity tab and the report say where sessions usually end, where he pauses, which sections take him much longer than usual, which come easily, and when in the day he finishes most. Each pattern comes with something to try.
- **What the app does about it.** When he pauses, his guide offers to read aloud or give a hint. When he gets past the step where his sessions usually end, he gets a bonus and is told so. Demos he does not need are skipped, and every demo has a "Got it, skip" button.
- **Flight kit.** His guide gears up for the flight to Australia: twelve pieces, from a flight cap to pilot wings. Points reward thinking rather than tapping through (4 right on the first tap, 2 with the clue, 1 off when the answer is shown, none for a guess faster than reading, 3 per finished session), gear once earned is never taken back, a meter fills during each session, and every new piece gets a celebration.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173. On first run a grown-up sets a nickname and an optional 4-digit code, then hands over the device. The learner picks a guide and interests, then takes a short scouting trip that sets his starting steps.

## Checks

```bash
npm run ci
```

That runs content validation, the type check, the engine tests and a production build.

```bash
npm run e2e
```

That runs Playwright with axe (WCAG 2.2 AA) on the installed Microsoft Edge.

```bash
pipeline/.venv/Scripts/python pipeline/check.py
```

That checks the reading level of every prose passage. Create the venv once with `python -m venv pipeline/.venv` and `pipeline/.venv/Scripts/pip install -r pipeline/requirements.txt`.

`npm run content:check` runs the reading-level check plus the content checks from LTF-16: coherence (a sentence that shares no people or things with what came before), each question's inference level and school-goal tags, and near-duplicate passages. The new checks only warn until they agree with a hand-rated gold set (`evals/gold/`), and then block only new problems; today's flags are recorded in `pipeline/baseline.json`.

Typed answers will be scored by a model only after it passes a test set (LTF-17, `evals/scoring/`): 300 invented child-style answers to 30 open questions, scored blind by two people in `evals/scoring/rate.html` as clearly right, partly right or clearly wrong. `python evals/scoring/scoring.py agree` compares the two people, and `scoring.py check <scores.json>` judges a scorer, which passes at 0.80 agreement in every band, not just overall.

[Why it works](docs/why-it-works.md) links each feature to the research behind it, and says which choices are ours rather than a study's. The [research page](https://dweissenborn.github.io/learning_to_fly/) goes into each study in depth.

## Layout

| Path | What it holds |
| --- | --- |
| `apps/web/` | The React PWA |
| `packages/engine/` | The rules: mastery, review dates, the gate, item choice, placement. Pure TypeScript with tests. |
| `packages/schema/` | JSON Schema for the content bank and the event log, the generated types, and the content validator |
| `content/bank/` | 18 skill files: 895 passages, 2,555 practice items, 9 inference-check items, 18 worked examples |
| `content/` | Skill wording, the scouting check, and the vocabulary for the daily recount |
| `api/` | The cloud copy's API: managed Azure Functions over Cosmos DB, with tests |
| `pipeline/` | The reading-level check |
| `e2e/` | End-to-end and accessibility tests |
| `site/` | The public research page, published to GitHub Pages by `.github/workflows/pages.yml` |

## Hosting

The research page in `site/` is a plain static page with its own fonts and no outside scripts. `.github/workflows/pages.yml` publishes it to https://dweissenborn.github.io/learning_to_fly/ whenever `site/` changes on `main`. Turn it on once under Settings, Pages, Source: GitHub Actions. Only `site/` is published; the plan, the backlog and the app stay where they are.

The app is live at https://victorious-hill-0c4aff11e.3.azurestaticapps.net, an Azure Static Web App on the Free plan. `apps/web/public/staticwebapp.config.json` sets the security headers and the fallback route.

`.github/workflows/deploy.yml` runs every check on each push and pull request. On `main`, a second job deploys the checked build once all checks pass. It runs in the GitHub environment `production` and uses that environment's secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (the Static Web App's deployment token). The deploy step is skipped while that secret is missing.

### Who can open it

The live site is open only to Microsoft accounts invited to the `family` role (`apps/web/public/staticwebapp.config.json`). Visitors who aren't signed in go to Microsoft sign-in. A signed-in account without the role sees `not-invited.html`. The install manifest and icons stay public so the app can be installed to a home screen. GitHub sign-in is blocked.

To invite someone, open the Static Web App in the Azure portal, then Role management, then Invite. Choose Microsoft Entra ID as the provider, enter their email and the role `family`, and send them the link. The link is valid for up to seven days. The Free plan allows up to 25 invited users. The same can be done with `az staticwebapp users invite --roles family`.

After a grown-up signs in once on a device, the app's offline copy keeps opening without asking again. The app looks for a new version every 30 minutes and whenever it comes back to the front, and switches to it only on the home screen with nothing open, or while it is in the background, never during a session (`apps/web/src/update.ts`). Fetching a new version needs the family sign-in, so while that has expired, the new version arrives after the next sign-in. The grown-ups' Settings shows when the running copy was built.

Local development (`npm run dev`) has no sign-in.

### Where progress is kept

Each device keeps its learner's progress in the browser (IndexedDB), so the app works offline. On the live site, a signed-in family member also gets a cloud copy in Azure Cosmos DB, through a small API in `api/`.

- **Learners belong to the family, not to a login.** Any invited account can open any learner. A new device asks who is learning, then downloads that learner's progress. Someone new can be set up instead.
- **Every change goes up, and other devices' changes come down.** Changes are sent soon after they happen, every 30 seconds while the app is open, and when the connection comes back. Answers and sessions are append-only, so two devices never conflict. Settings use the last change made.
- **The grown-ups' Data tab controls it.** It shows the sync status, switches learners, saves a device-only learner to the cloud, and deletes a learner from this device or everywhere.

The cloud copy needs a Cosmos DB for NoSQL account (serverless is enough) with database `learning-to-fly` and container `data`, partitioned on `/learner`. The Static Web App reads the connection string from the app setting `COSMOS_CONNECTION`. `api/test/live-check.mjs` checks a real account end to end.

## Licence

- The code is under the MIT License in [LICENSE](LICENSE).
- The content in `content/` (passages, items, skill wording, the scouting check and the recount vocabulary) is under [CC BY-SA 4.0](content/LICENSE.md). Each passage carries its own credit line.
