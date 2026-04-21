# Quality Assurance Anti-Patterns To Avoid

## Lint only, called done

Bad shape:

- the pass runs lint and maybe typecheck, then declares the feature verified

Why to avoid it:

- final QA needs flow truth, not only static checks

## Swagger without direct API checks

Bad shape:

- the verifier inspects docs only and skips the real endpoint behavior

Why to avoid it:

- a documented contract can still be wrong at runtime

## Browser reachability treated as success

Bad shape:

- Playwright reaches the page but primary actions, modals, denial paths, or visible post-action states are not checked

Why to avoid it:

- the surface can still be broken even when the route loads

## QA silently fixing architecture

Bad shape:

- the final verifier starts rewriting hooks, services, or contracts instead of reporting the failure back to the owning skill

Why to avoid it:

- it blurs ownership and weakens the final gate
