# Eve completed-turn memory capture reproduction

A minimal Eve app, scaffolded with `npx eve@0.52.5 init`. It uses the public `mockModel` and `defineMemoryProvider` APIs. No model credentials, database, or ACE code are involved.

## Run

Requires Node 24 and npm.

```sh
npm ci
npm run repro
```

The runner starts `eve dev` on localhost:21871, sends one message through the HTTP session API, reads the event stream through `session.waiting`, and checks the provider's log markers. It stops its server afterward. Set `REPRO_PORT` to use another port.

Expected: the turn completes, recall runs, and capture runs.

Exit codes: 0 = capture ran; 1 = completed turn and successful recall but missing capture; 2 = setup or runtime failure (inconclusive).

The provider is in `agent/memory.ts`. Its capture callback only logs the number of messages it receives. Full server logs, stream events, and counts are written to `results/`.

## Compare versions

```sh
npm install --save-exact eve@0.50.0
npm run repro
npm install --save-exact eve@0.52.5
npm run repro
```

These commands change only this fixture's dependency and lockfile.

## Verified results (September 10, 2026)

The same app and HTTP runner were executed against clean npm installs:

| Eve | Turn completed | Recall calls | Capture calls | Exit |
| --- | --- | --- | --- | --- |
| 0.50.0 | yes | 1 | 1 | 0 |
| 0.51.0 | yes | 1 | 0 | 1 |
| 0.52.5 | yes | 1 | 0 | 1 |

The 0.52.5 result and complete server log are included in `results/`. The runner saves logs and events for subsequent runs. These are full local `eve dev` runs, not extracted-function tests. Tested on macOS arm64 with Node 24.19.0. The checkout is pinned back to 0.52.5.

No provider or Eve code was patched.
