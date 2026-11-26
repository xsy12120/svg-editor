# CLI Transcript Baselines

## `cli-1.txt`

Deterministic Phase 1 editing session. The file contains commands only and is
used as the compatibility baseline for later Phase 2 assembly comparisons.

## `cli-1.stdout.sha256`

SHA-256 of the exact process stdout for `cli-1.txt`.

The baseline intentionally uses a hash because the CLI ends with an open
`svg> ` prompt and does not append a trailing newline. This verifies the
output byte-for-byte without depending on editor newline normalization.

Run:

```powershell
npm test -- --run tests/e2e/phase1-golden.test.ts
```

Do not update this hash when refactoring. Intentional Phase 1 behavior changes
are outside the scope of Phase 2 and should be treated as regressions.

## Dual-assembly acceptance

The following inputs are shared by code assembly and configuration assembly:

- `cli-2-dual-base.txt`: Phase 1 editing and tree behavior.
- `cli-2-dual-box.txt`: box creation, attributes, movement and undo.
- `cli-2-dual-extensions.txt`: `stats` and `dir`.

The matching `.stdout` files contain the expected process output. Run:

```powershell
npm run verify:assembly
```

The verifier checks:

- both assemblies use the same five optional plugins, in the same order and
  with the same options;
- both produce byte-identical output for all three inputs;
- `dir` runs against `tests/fixtures/assembly-workdir` with fixed contents;
- disabling every optional plugin keeps `cli-1.txt` byte-identical to the
  Phase 1 `final` baseline;
- every required input, expected-output and configuration path exists before
  comparison.

`cli-1-final.stdout` is the readable form of the Phase 1 output.
`cli-1.stdout.sha256` remains the authoritative `final` compatibility hash.

The expected-output files are baseline artifacts, not handwritten test input.
After an intentional output change, regenerate and review them with:

```powershell
node scripts/verify-assembly.mjs --write
```

Never use `--write` merely to make a regression pass.
