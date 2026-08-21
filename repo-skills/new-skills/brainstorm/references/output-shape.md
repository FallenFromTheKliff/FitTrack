# Brainstorm Output Shape

Use this shape unless the user clearly asks for something narrower:

- `Goal`
- `Review verdict`
- `Hidden holes`
- `Constraints`
- `Options`
- `Recommended MVP`
- `Later ideas`
- `Risks to avoid`

For surface-elevation prompts, also include:
- `Operator-first additions`
- `Keep / Replace / Remove / Add suggestions`
- `Current tier`
- `Target tier`
- `Figma lane status`
- `Missing component opportunities`
- `Weak components`
- `Component replacement candidates`
- `Premium blockers`
- `Reference lane`
- `Major component scan`
- `Reference targets by component`
- `Copy-density cuts`
- `Header compression needs`
- `Navigation experience gaps`
- `Data rendering opportunities`
- `Route risks`
- `Untouched surface risks`
- `Visual delta risk`
- `Redesign recommendation`

## Quality bar

- The recommendation should be practical enough to hand to `system-adapt` or `integration`.
- Options should be meaningfully different, not cosmetic rewrites of the same answer.
- When the review verdict is not `good_enough`, at least one option should be a genuine redesign or component-replacement option.
- Operator-first additions should improve the route's main job instead of broadening scope for novelty.
- Later ideas should stay clearly separate from the MVP.
- If the answer starts sounding like a giant backlog, narrow it again.
