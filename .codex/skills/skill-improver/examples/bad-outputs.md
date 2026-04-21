# Skill Improver Anti-Patterns To Avoid

## Broad rewrite for a narrow failure

Bad shape:

- a small recurring miss leads to rewriting the entire skill

Why to avoid it:

- this makes trigger boundaries drift and increases token bloat without fixing the actual failure

## Verified but uncanny outputs ignored

Bad shape:

- the target skill produces outputs that technically run or verify
- but the resulting page or flow still feels unfinished, uncanny, or obviously partial

Why to avoid it:

- repeated `verified but uncanny` misses are a real skill failure and should be codified surgically
