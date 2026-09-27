# Contributing to stellar-txwatch-web

Thanks for your interest in contributing! This is the web dashboard for the [Tx-wats](https://github.com/Tx-wats) org.

## Sister repos

| Repo | Description |
|------|-------------|
| [stellar-txwatch-core](https://github.com/Tx-wats/stellar-txwatch-core) | Rust monitoring engine |
| [stellar-txwatch-contracts](https://github.com/Tx-wats/stellar-txwatch-contracts) | Soroban smart contracts |
| [web](https://github.com/Tx-wats/web) | This repo - Next.js dashboard |

## Local setup

```bash
git clone https://github.com/Tx-wats/web
cd web
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Requirements

- Node.js 18.17 or later
- npm (installed with Node.js)
- [Freighter wallet extension](https://www.freighter.app/) for wallet-gated features

Note: The project specifies `engines.node >= 18.17` in `package.json`. CI enforces this using Node 20.

## Branch naming

```
feat/<short-description>
fix/<short-description>
chore/<short-description>
```

## Commit style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(component): add X
fix(page): correct Y
chore: update deps
```

## TypeScript types

All types live in `types/index.ts` and must stay in sync with the Rust structs in `stellar-txwatch-core`. Do not add fields here without a matching change in the core engine.

## Pull requests

- Keep PRs focused - one feature or fix per PR
- All pages must be mobile responsive and dark-mode compatible
- Run `npm run format`, `npm run typecheck`, and `npm run lint` before opening a PR
- Update documentation if you modify file responsibilities — see [ARCHITECTURE.md](../ARCHITECTURE.md)
- Include a PR description matching the template in `.github/pull_request_template.md`

### Pre-submission checklist

```bash
npm run format      # Auto-format code
npm run format:check # Verify formatting
npm run typecheck   # Check TypeScript types
npm run lint        # Run ESLint
npm run build       # Verify the build
```
