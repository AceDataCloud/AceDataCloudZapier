# Zapier publication and acceptance worksheet

As of 2026-10-18, this integration is source-only. No integration ID, uploaded private version, successful enabled Zap, billing evidence, or App Directory listing has been recorded. This worksheet prepares a reviewable rollout; its unchecked items are not evidence of completion.

## Listing draft

| Field | Proposed value | Evidence still needed |
| --- | --- | --- |
| Name | Ace Data Cloud | Confirm branding in Developer Platform and rule out an existing app before registering. |
| Description | Ace Data Cloud is an AI API platform for Suno music and chat workflows. | Read back after private push. |
| Marketing homepage | https://acedata.cloud | Confirm the listing uses the marketing site rather than the console/login page. |
| Category | Artificial Intelligence → AI Models | Confirm the current choices in Developer Platform. |
| Icon | [Transparent 512 px PNG](assets/acedatacloud-icon.png) | Upload and inspect rendering in Developer Platform. |
| Privacy / terms / support | [Privacy](https://docs.acedata.cloud/en/resources/privacy), [terms](https://docs.acedata.cloud/en/resources/terms), [support](https://docs.acedata.cloud/en/resources/support) | Confirm current data handling and safe contact instructions. |
| Help article | [English draft](HELP.md) | Publish from the owning documentation source, then record its actual public URL. |
| Actions | Generate Suno Music; Retrieve Suno Music Task; Create Chat Response | Suno inspiration-mode generation, same-task retrieval and text chat only. No other media service is included. |

All Zapier interface fields and error messages remain in English. The Chinese ecosystem report is a separate internal deliverable.

## Private upload

- [ ] Use an existing AceDataCloud-owned Developer account or safely configured deploy key. An authorized account owner must handle any Platform Agreement acceptance.
- [ ] List integrations and link the existing app. Register once only if no app exists.
- [ ] Record integration ID, owning account, linked project, source commit, and private version `0.0.1`.
- [ ] Use the pinned CLI via `npx --no-install zapier-platform`. The CLI accepts `ZAPIER_DEPLOY_KEY` or `ZAPIER_AUTH_LOCATION` when securely configured; neither is an Ace API token.
- [ ] Run `npm ci`, `npm test`, `npm run validate`, `npm run validate:publish`, and `npm run build` on Node 22.
- [ ] Run `zapier-platform push`; read back the actual uploaded version and private status. Build success alone is not upload proof.
- [ ] Invite only an existing, authorized test user if needed. Do not create duplicate accounts or distribute an irrevocable public invite link.

## Real Zap acceptance

No paid call is authorized by this worksheet. Agree a model, current package rate, input/output limits, and total call budget first. The editor Test and the enabled Zap run are separate paid calls.

The existing chat case below is a separate budget candidate, not a Suno quote. Suno acceptance must re-read current `/suno/audios` cost and the actual account package.

Suggested chat-only minimum case: a non-sensitive, short prompt `Reply with exactly: ACE_ZAPIER_OK`, no system instructions, and a small supported output limit. Choose one model from the current catalog that the test token can use. Use a one-off trigger event; turn off the Zap after one run so acceptance does not become recurring generation.

| Check | Required evidence | Status |
| --- | --- | --- |
| Private install | Integration ID, version, source commit and account access | Pending |
| Connection | Successful read-only auth test; invalid token reconnect behavior | Pending |
| Picker | Current chat models shown in the actual Zap editor | Pending |
| Editor action test | Returned text, response ID, model, finish reason and token counts | Pending; paid |
| Enabled Zap | Zap ID and successful Zap History URL, timestamp and version | Pending; paid |
| Billing | Each paid call separately matched to one terminal usage record, with trace/response correlation and Credits consumed | Pending |
| Replay control | If a result is uncertain, inspect that same run and usage before retrying; document any extra attempts | Pending |
| Disable test | Turn off scheduled Zap after the one-run proof | Pending |

Only expected failures known to avoid a paid completion may be exercised without a generation budget. Use local mocks for rate limits, moderation, balance errors, and request rejection until an authorized live test case is available. Do not trigger repeated paid errors solely for evidence.

Credits are not USD. For the test account's current package, record `USD per Credit = package price / package amount`, then `USD cost = terminal consumption in Credits × USD per Credit`. Keep the package currency and any account discount explicit. A public pricing row alone does not prove the account's actual package rate.

## Budget candidate (not authorized)

A 2026-10-12 read of the [current public catalog with pricing](https://platform.acedata.cloud/api/v1/models/?type=chat&with_pricing=1) includes `gpt-4o-mini`. Its live API cost rule uses 0.315371 Credits per million input tokens and 1.261484 Credits per million output tokens. For an estimated 64 input tokens and at most 32 output tokens, that is about 0.00006055 Credits per call, or 0.00012110 Credits for one editor test plus one enabled Zap run. This is an estimate, not a bill.

The [current public packages](https://platform.acedata.cloud/api/v1/services/openai) range from 7 USD / 40 Credits to 13584 USD / 142800 Credits: about 0.095126–0.175 USD per Credit. At those public rates, the two-call estimate is about 0.00001152–0.00002119 USD. Confirm the test account's actual package and discounts before executing. A proposed two-call authorization ceiling is 0.01 Credits (about 0.00095–0.00175 USD at public rates); no authorization has been granted.

The model's live rule also has `max_credits: 1`, so the gateway balance precheck may require at least 1 Credit available even for this tiny completion. Verify the actual key/balance precheck; an output limit or estimated spend is not a hard account spending cap. Do not automatically replay an uncertain call, substitute models, or top up the account.

## Attribution acceptance

Acquisition links retain the approved `utm_source=opensource`, `utm_medium=referral`, `utm_campaign=evergreen` convention. Zapier entry points are identified by `utm_content=suno_zapier_readme_*`, `zapier_auth_api_key`, or `zapier_help_*`. These parameters are navigation metadata, not API credentials, and are not added to chat requests.

- [ ] Open the tagged Applications link as an ordinary user; verify the attribution survives any sign-in/register redirect.
- [ ] Read back the resulting registration/source event. Record event time and redacted account correlation.
- [ ] Connect a separately named Zapier token and correlate a first successful usage record without publishing the token.
- [ ] Record Zapier install/connection/active-use metrics separately from Ace registration and usage. Link click counts are not installs or successful calls.

## Suno publication and task acceptance

- [ ] Confirm the platform account uses exactly one Ace Data Cloud integration. Independent Suno/Seedance apps are not registered under the same API/auth only for keyword discovery. [Publishing requirement 2.2](https://docs.zapier.com/integrations/publish/integration-publishing-requirements#22-multiple-integrations) says to consolidate unless they are genuinely independently marketed products/services.
- [ ] Use **Generate Suno Music** and **Retrieve Suno Music Task** as the exact service-specific action names. The app description and help explicitly say the integration is supplied by Ace Data Cloud; do not imply Suno's official endorsement.
- [ ] Read the current `chirp-v6` price and test account package; authorize one editor test and one enabled Zap music submission separately, then disable the test workflow. No Suno generation is authorized by this file.
- [ ] Record accepted task IDs separately from completed results. Confirm callback→resume uses an authenticated `/suno/tasks` read of the exact original ID; verify terminal success and playable final audio. A task ID or streaming preview is not a completed file.
- [ ] Test recovery using **Retrieve Suno Music Task** without creating a new generation; confirm pending media is withheld and failed status is explicit.
- [ ] Match each paid submission to one terminal usage record. Polls/callbacks must not be counted as new generations; preserve trace and task correlation.
- [ ] After official publication, test ordinary-user directory queries `suno`, `Suno by Ace Data Cloud`, `Ace Data Cloud` and exact action search. Record whether the app and action are actually discoverable; naming metadata is not a search result or ranking guarantee.
- [ ] Do not advertise Seedance, HappyHorse, GPT Image or Nano Banana as implemented. Each needs its own action contract, native fields, task/terminal handling, docs and live acceptance.

The generated callback URL is private workflow metadata, not a user-configured webhook field. Do not publish it in screenshots. Callback payloads are used only to identify the original task; final results are re-read using the user's Ace API token.

General check D004 may recommend a dynamic task-ID dropdown. This API supports lookup by a known task ID, not listing all user tasks; map the original generation ID rather than adding an invented list endpoint. The readonly recovery action deliberately accepts that original ID.

## Native provider request material (prepared, not submitted)

Target: add **Ace Data Cloud** to **AI by Zapier → Bring Your Own Key → Provider**, comparable to the supported first-party providers. This is a separate outcome from App Directory publication.

Official provider evidence: [AI by Zapier guide](https://help.zapier.com/hc/en-us/articles/8496342944013-Use-AI-by-Zapier-to-analyze-and-return-data) lists OpenAI, Anthropic, Google Gemini, Azure OpenAI and Amazon Bedrock (read 2026-10-18). No public self-service registry or custom-provider/base-URL onboarding is documented. The independent [OpenRouter app](https://zapier.com/apps/openrouter/integrations) demonstrates the public-app path, not automatic membership in this built-in provider list.

Reviewable facts for a future authorized technical submission: Ace owns its API surface; calls use application API tokens; a free token check is `GET https://api.acedata.cloud/v1/models`; chat models are selectable from `https://platform.acedata.cloud/api/v1/models/?type=chat`; chat uses `POST https://api.acedata.cloud/v1/chat/completions`; platform-management tokens are separate; the LLM action is text-only, non-streaming and has no tools/memory contract. Zapier's agentic/tool/structured-output requirements would need their own verified support before claiming native-provider parity. Do not send credentials in a public ticket. No provider request, partner agreement, outbound marketing, or approval is claimed here.

## Public submission gate

- [ ] Current online validation has no failing publishing checks; resolve actionable warnings.
- [ ] Add an admin with an `@acedata.cloud` address.
- [ ] Supply a non-expiring, feature-enabled account for `integration-testing@zapier.com` through Zapier's secure submission form. Do not commit its credentials or send them in a public issue.
- [ ] Preserve at least one successful enabled Zap and its Zap History for every offered action.
- [ ] Confirm actual public help URL, API documentation, branding and privacy details.
- [ ] Prepare `1.0.0` deliberately, submit through **Publish**, and record submission ID/date/status. Submission alone remains private.
- [ ] After approval, verify the public Beta listing by directory search and ordinary-user installation; record actual URL and version.

Private upload is D0. A searchable, installable public Beta listing can satisfy D1. Neither establishes D2 (native default) or D3 (official featured). Prepare workflow templates only after public Beta makes them eligible; templates and Partner Program tiers also do not establish D2/D3.

Before another push or promotion, read the current version lifecycle state and user count. Promoted/public versions cannot be overwritten; private versions also have editing restrictions as their user count grows. Publish a new version when required and keep older Zaps accounted for.

## Official references

Verified on 2026-10-12: [CLI and Node 22](https://docs.zapier.com/integrations/build-cli/overview), [publishing requirements](https://docs.zapier.com/integrations/publish/integration-publishing-requirements), [branding](https://docs.zapier.com/integrations/publish/branding-guidelines), [user help](https://docs.zapier.com/integrations/publish/user-help), [private/public types](https://docs.zapier.com/integrations/quickstart/private-vs-public-integrations), [public Beta review](https://docs.zapier.com/integrations/publish/public-integration), [version rules](https://docs.zapier.com/integrations/manage/versions), and [Partner Program](https://docs.zapier.com/integrations/publish/partner-program).
