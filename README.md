# Learning to fly

Learning to fly is a reading game for autistic children. The app itself is called Wayfinder. It is a local-first web app: it works offline, installs to a home screen, and keeps every answer on the device.

The learner builds an island. Each finished session adds one thing to it, and three paths across the island light up as skills are mastered:

- **Harbor Town** is reading to do: signs, steps, timetables, labels, messages, on-screen prompts.
- **Story Woods** is reading to follow a story: who, where and when, order, causes, pronouns, feelings, main idea.
- **Lantern Peaks** is reading to think about life. It stays "coming up" until the gate in the plan opens.

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

`npm run build` writes a static site to `apps/web/dist`. `apps/web/public/staticwebapp.config.json` is ready for Azure Static Web Apps. Creating the Static Web App from a GitHub repository generates the deploy workflow.

## Licence

- The code is under the MIT License in [LICENSE](LICENSE).
- The content in `content/` (passages, items, skill wording, the scouting check and the recount vocabulary) is under [CC BY-SA 4.0](content/LICENSE.md). Each passage carries its own credit line.
