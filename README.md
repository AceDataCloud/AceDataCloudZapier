# AI media and chat for Zapier — by Ace Data Cloud

Generate Suno music from a Zap, wait for the original task, and pass completed audio URLs to later steps. This is an **Ace Data Cloud integration** using your Ace API token. It is not an official Suno application or an endorsement by Suno or Zapier.

[简体中文](readme/README_zh_Hans.md) · [User help](HELP.md) · [Publication checklist](PUBLISHING.md)

## 1. Install / publication status

**Source preview, version 0.0.1. No Zapier private version, public listing, successful Zap, or billing evidence has been recorded.** The [Zapier App Directory](https://zapier.com/apps) is the eventual official installation channel; this repository is not an installation link. Once an authorized administrator uploads the single Ace Data Cloud app privately, use that exact invitation/version in your account. A public installation link will be added only after approval and a real readback.

| Action in the Ace Data Cloud app | Input | Output |
| --- | --- | --- |
| **Generate Suno Music** | Suno model, music prompt, instrumental toggle | Waits via Zapier callback, then reads the same task and returns completed audio URLs |
| **Retrieve Suno Music Task** | Original Ace task ID | `pending`, `failed`, or `succeeded`; final audio only on success; never submits generation |
| **Create Chat Response** | Chat model, prompt, optional system instructions / token limit | Text and response/usage mapping fields |

Service names appear in native actions and dedicated guides; public keyword discovery is an acceptance check, not an assumed ranking.

| Additional native action and same-ID recovery | Current mode / guide |
| --- | --- |
| **Generate Seedance Video** / **Retrieve Seedance Video Task** | [Text and optional first-frame video](readme/services/seedance.md) |
| **Generate HappyHorse Video** / **Retrieve HappyHorse Video Task** | [Text-to-video](readme/services/happyhorse.md) |
| **Generate GPT Image** / **Retrieve GPT Image Task** | [Image generation; no editing](readme/services/gpt-image.md) |
| **Generate or Edit Nano Banana Image** / **Retrieve Nano Banana Image Task** | [Generate/edit with reference images](readme/services/nano-banana.md) |

All actions are in the same source-only app. Private upload, actual Zap results and public discovery are still pending.

## 2. Register / sign in and get the right API token

1. Open [Ace Data Cloud → Applications](https://platform.acedata.cloud/console/applications?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=suno_zapier_readme_api_key). Register or sign in first.
2. Open **General application**. If missing, choose **Initialize General Application**. Its key can use the services available to your account; a dedicated application is limited to its service. Check Suno entitlement, current price and balance before any generation.
3. Copy an existing key from the card, or open **Manage Keys → Create** and name a dedicated key `Zapier Suno`.

![Copy an API token or open Manage Keys — existing platform tutorial](assets/tutorial/get-api-key-en.png)

4. Review **Expiration Time**, **Set Usage Limitation** and **Allowed APIs**. If API restrictions are enabled, include both `/suno/audios` and `/suno/tasks` for this workflow. The chat action also needs its own Chat Completions access. The read-only connection test cannot prove access to every generation API.
5. Copy only the raw API token, with no `Bearer ` prefix, quotes or spaces. A `platform-...` management token cannot replace it.

The reused screenshot's name `Dify tutorial` is only an example; enter `Zapier Suno` for this connection.

![Create an independently named token — existing platform tutorial](assets/tutorial/create-api-key-en.png)

[Current Suno service and pricing](https://platform.acedata.cloud/services/suno?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=suno_zapier_readme_pricing) · [Current models](https://platform.acedata.cloud/models?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=suno_zapier_readme_models). Any trial allowance is whatever your account currently shows. Credits are not USD; use your current package rate. Creating music and the editor's Test button consume Ace balance; Zapier tasks are separately metered.

## 3. Connect in Zapier

In the private Ace Data Cloud app, add an account. Paste the raw value into **API token**, and use **Connection name** for a short non-secret label such as `Work`. The label is not forwarded to Ace. Credentials belong only in the account connection, never in prompts or workflow exports.

![Official Zapier screenshot edited as an Ace connection preview — not an actual run](assets/tutorial/zapier-connection-preview.png)

This is an **official-screenshot edited preview**, edited on 2026-10-17 and reused on 2026-10-18. The original capture date is unknown. It does not prove connection success, installation, an uploaded version, or an exact current editor layout. [Original official source and image provenance](assets/tutorial/sources.json).

## 4. Create a Suno workflow

After private access is available, build:

**Your one-off trigger → Ace Data Cloud: Generate Suno Music → a destination for Audio URL**.

| Zapier field | Example value |
| --- | --- |
| Suno Model | `chirp-v6` (select it explicitly; account access and price apply) |
| Music Prompt | `A gentle instrumental piano melody for a sunrise, no vocals.` |
| Instrumental | `true` |

The action currently uses inspiration mode (`custom=false`), prompt length 1–500 characters, and exactly the model selected. It does not silently substitute models. Custom lyrics, extension, cover and stem actions are outside this version.

The editor's **Test** makes a real paid request. Do not press it without deciding your spend first. The app submits once with a Zapier callback URL. Zapier keeps the action waiting while Suno works. When notified, the app checks the **same task ID** using the authenticated task API, rather than trusting callback audio links. Only terminal success with valid audio URLs is returned to later steps.

No actual Suno-in-Zapier run screenshot exists yet. The connection preview above must not be treated as one.

## 5. Recover the original task and map completed audio

If a callback is late or a run is uncertain, **do not rerun generation**. Copy the original **Ace Task ID** from Zap History or the app's task record. In a separate step use **Retrieve Suno Music Task** and paste/map that ID. This checks an existing task and does not submit music generation.

- `status=pending`, `success=false`: check that same ID later. Preview media URLs are not exposed as completed output.
- `status=failed`, `success=false`: inspect usage and support details before a new submission.
- `status=succeeded`, `success=true`: map **First Completed Audio URL**, **Completed Audio URLs**, or the **Track Audio URL** line items to the next step.

The first URL is one returned track, not a replacement model or a separately charged request. When multiple tracks return, preserve all completed URLs. A completed Zap step is not an independent billing proof; match the task/trace/time to the usage record. Never publish a key, callback URL or private prompt.

Before replaying an uncertain POST, check [Ace usage](https://platform.acedata.cloud/console?utm_source=opensource&utm_medium=referral&utm_campaign=evergreen&utm_content=suno_zapier_readme_usage). Automatic replays can charge again because generation has no cross-request idempotency key. Stop a scheduled test Zap after its one accepted event.

## 6. Troubleshooting

| Symptom | Check |
| --- | --- |
| Ace app is absent | Source code does not grant account access. Ask the existing app administrator for the actual private version; no public listing is claimed. |
| Connection fails | Raw token, expiry, application access, usage restrictions and balance; reconnect after rotating it. |
| Connection works but Suno fails | Allow `/suno/audios` and `/suno/tasks`; the model-list test does not prove those permissions. |
| Rate limit | Media submission does not opt into throttle replay; check the original task before manual replay. Existing task queries may be delayed and retried. |
| Callback mismatch / pending | Do not rerun generation. Retrieve the original task ID. A mismatch cannot resume another task. |
| No final audio | The task may still be running, failed or returned no valid completed audio. Retrieve the same ID and review usage. |
| Blocked content / insufficient balance | Respect the returned category, review content or application balance; no model fallback is inserted. |

[Support](https://docs.acedata.cloud/en/resources/support) accepts model, approximate time, task ID and trace ID. Never send an API token. [Privacy](https://docs.acedata.cloud/en/resources/privacy) · [Terms](https://docs.acedata.cloud/en/resources/terms).

## Developer checks

Use Node 22 and the pinned Zapier core/CLI. From this repository root:

```bash
npm ci
npm test
npm run validate
npm run validate:publish
npm run build
```

Tests discover the test tree. Core-runtime HTTP calls are mocked with network disabled, including submit→callback→authenticated retrieve, pending/failed outputs, task-ID mismatch and credential leakage checks. Build is local; neither tests nor schema validation upload an app or execute paid generation. Online publishing checks are also distinct from account review.

Authentication/deploy steps and the separate native-provider goal are in [PUBLISHING.md](PUBLISHING.md). Current native **AI by Zapier** provider choices are controlled by Zapier; publishing this app does not automatically add Ace there.
