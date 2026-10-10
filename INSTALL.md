# Restricted setup

Use the root README. No dependency installation, cookie import, global MCP setup or browser login is needed or supported.

1. Check `node --version` is at least 22.13.
2. Run `node --check safe-public.mjs` and `node --test safe-public.test.mjs`.
3. Independently review a public GET/HEAD URL and put that exact URL/method in spec.json and policy.json.
4. Run `node safe-public.mjs spec.json policy.json --network` only when the request is approved.

Do not run the retained legacy installers, src/cli.ts, credential importer, browser learner or MCP server. Do not put secrets or personal data in the inputs. This reduced version is not an authenticated drop-in replacement and does not certify any upstream code as safe.
