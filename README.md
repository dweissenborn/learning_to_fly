# Learning to Fly

Learning to Fly is a reading game for autistic children. It is a local-first web app: it works offline, installs to a home screen, and keeps every answer on the device.

The learner starts on Home Island and builds it up: each finished session adds one thing to it, and three paths across the island light up as skills are mastered.

- **Harbor Town** is reading to do: signs, steps, timetables, labels, messages, on-screen prompts.
- **Story Woods** is reading to follow a story: who, where and when, order, causes, pronouns, feelings, main idea.
- **Lantern Peaks** is reading to think about life. It stays "coming up" until the gate in the plan opens.

Every finished session also moves the learner along a journey: the ferry to Gull Island, Windy Cape, Cloud Hill Airfield, take-off in a small red plane called the Kookaburra, and finally Australia to visit the koalas. Small clues appear on the island and after each session. Along the way there are setbacks: a storm, a blocked path, a broken propeller, strong winds. Each is explained, comes with a calm coping line and a choice of plan, and never costs anything. The journey moves with finished sessions, never with scores; a grown-up can set its pace or turn setbacks off.

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

## Layout

| Path | What it holds |
| --- | --- |
| `apps/web/` | The React PWA |
| `packages/engine/` | The rules: mastery, review dates, the gate, item choice, placement. Pure TypeScript with tests. |
| `packages/schema/` | JSON Schema for the content bank and the event log, the generated types, and the content validator |
| `content/bank/` | 18 skill files: 133 passages, 260 practice items, 9 inference-check items, 18 worked examples |
| `content/` | Skill wording, the scouting check, and the vocabulary for the daily recount |
| `pipeline/` | The reading-level check |
| `e2e/` | End-to-end and accessibility tests |

## Hosting

The app is live at https://victorious-hill-0c4aff11e.3.azurestaticapps.net, an Azure Static Web App on the Free plan. `apps/web/public/staticwebapp.config.json` sets the security headers and the fallback route.

`.github/workflows/deploy.yml` runs every check on each push and pull request. On `main`, a second job deploys the checked build once all checks pass. It runs in the GitHub environment `production` and uses that environment's secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (the Static Web App's deployment token). The deploy step is skipped while that secret is missing.

### Who can open it

The live site is open only to Microsoft accounts invited to the `family` role (`apps/web/public/staticwebapp.config.json`). Visitors who aren't signed in go to Microsoft sign-in. A signed-in account without the role sees `not-invited.html`. The install manifest and icons stay public so the app can be installed to a home screen. GitHub sign-in is blocked.

To invite someone, open the Static Web App in the Azure portal, then Role management, then Invite. Choose Microsoft Entra ID as the provider, enter their email and the role `family`, and send them the link. The link is valid for up to seven days. The Free plan allows up to 25 invited users. The same can be done with `az staticwebapp users invite --roles family`.

After a grown-up signs in once on a device, the app's offline copy keeps opening without asking again. New versions arrive after the next sign-in, from the grown-ups' area under Data.

Local development (`npm run dev`) has no sign-in.

## Licence

- The code is under the MIT License in [LICENSE](LICENSE).
- The content in `content/` (passages, items, skill wording, the scouting check and the recount vocabulary) is under [CC BY-SA 4.0](content/LICENSE.md). Each passage carries its own credit line.
