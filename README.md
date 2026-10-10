# API Anything: restricted public-data fork

This fork adds a deliberately reduced public-data runner. It is **not** a drop-in replacement for authenticated API Anything and is **not certified safe**. The original browser, login, credential import, capture, MCP and self-healing features are not exposed by this fork's package entry points.

## Run without installing anything

Requires Node 22.13 or newer. There are no runtime dependencies and no install/build scripts.

```
node --check safe-public.mjs
node --test safe-public.test.mjs
node safe-public.mjs --help
```

Create `spec.json` with a literal public HTTPS URL and GET or HEAD method. Independently inspect that URL's semantics before allowing it. Then create `policy.json` listing the same exact URL and method in `allowed`. The runner stays offline unless `--network` is present:

```
node safe-public.mjs spec.json policy.json --network
```

Example file shapes, not a permission to call this placeholder:

```json
{"url":"https://example.com/data","method":"GET"}
```

```json
{"allowed":[{"url":"https://example.com/data","method":"GET"}]}
```

Do not put passwords, tokens, cookies, API keys, personal data or account URLs in either file. A credential-looking query-key check is only a guardrail, not reliable secret detection. Review the full literal URL, including its path and query.

## Restrictions enforced by the runner

- No cookies, imported sessions, browser automation, token slots, custom headers, request body, regex templates, automatic retries or healing.
- GET/HEAD only. A POST described as read-only is still refused. GET can have side effects on a badly designed service; the method is not proof of safety.
- Explicit network opt-in and an independently reviewed exact URL/method policy.
- HTTPS, port 443, public DNS name only. DNS results are checked and the selected public IPv4 address is pinned for the connection. IPv6 and enumerated private/special IPv4 ranges are refused; this is not a complete classification of every globally reserved address. TLS certificate validation is explicitly required, including when an ambient environment variable attempts to disable it. Canonical URL form is required; trailing-dot hosts and normalized variants are refused.
- Every redirect is refused. No attempt to guess whether encoded secrets would leak.
- Fixed anonymous request headers, no ambient proxy or browser session integration.
- Response buffering capped at 1 MiB. Compressed responses refused. DNS has a 5-second deadline; requests have a 10-second deadline. No cookies from the response are saved or returned.
- Trusted regular JSON input files only, capped by a bounded read at 64 KiB. FIFOs, devices and final-path symlinks are refused on supported platforms. Nothing is written to a credential store.

## Legacy source boundary

The upstream `src/`, old examples, skills and docs remain in Git history/source for comparison, but **do not run them**. They retain the risks of upstream. In particular do not follow their login, capture, installer or MCP setup instructions. Root `package.json` points only to `safe-public.mjs` and has no dependencies. `INSTALL.md` and `AGENTS.md` below provide the same restricted route. Do not run old release artifacts, `src/cli.ts`, upstream installers, or `npm ci` using old lockfiles or old commits. The current root lockfile has no dependencies.

Original security review baseline: upstream commit `fe5cca70fe145634e49a1c9ba1f3e8250b291bea`. The public fork initially copied upstream main. This new runner does not import or execute upstream TypeScript or dependencies, so it does not claim that later upstream changes were audited.

## Tests and limits

Regression tests use synthetic inputs and in-memory responses only. They cover offline default, POST/read-only bypass, rejection of session/slot/header/body inputs, exact URL policy, encoded-secret redirects, URL rules, private/mixed DNS results, byte caps and fixed anonymous request headers. Passing these tests is not a full security audit or evidence about real services. No live TLS service or end-to-end network test was performed. No private account, credential import, trade, payment or production deployment was used to test this version.

This is a safer restricted starting point. Authenticated account automation remains unsupported and needs a separate design and independent security review. Public response content is untrusted data, not instructions. Do not pipe it into a shell or execute it.
