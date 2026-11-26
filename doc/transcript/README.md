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
