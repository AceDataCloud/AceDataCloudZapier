# Published API request-schema fixtures

Snapshot verified on 2026-11-23 against the Ace Data Cloud public API definitions. `api-contracts.json` retains request parameter types, enums, bounds and defaults for the five existing media actions; it omits response payloads, pricing and unrelated service data.

The runtime loads `https://platform.acedata.cloud/api/v1/apis/{api_id}/` anonymously. These fixtures are only offline test inputs. Tests compare all five selectors and generated requests with the published operation-specific model enums: GPT Image24,Seedance9,HappyHorse7,NanoBanana9,Suno10 (59choices,including overlaps across APIs).
