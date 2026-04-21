# Frontend UI UX Polish Anti-Patterns To Avoid

## Generic redesign over the top of FitTrack

Bad shape:

- the page becomes a polished but interchangeable dashboard that no longer feels like the existing product

Why to avoid it:

- this skill should preserve the app's special styles, not erase them

## Styling around a broken reusable surface

Bad shape:

- extra wrappers and one-off CSS try to hide that the real component or modal is still awkward

Why to avoid it:

- polish should improve the reusable surface, not paper over it

## Visual polish used to dodge logic gaps

Bad shape:

- layout gets prettier but the modal flow, action state, or empty-state logic is still broken

Why to avoid it:

- the owning architecture skill still needs to fix the actual behavior

## Over-designed modal

Bad shape:

- the modal uses extra decoration, too many colors, or confusing action order that hurts clarity

Why to avoid it:

- polish should increase confidence and readability, not spectacle
