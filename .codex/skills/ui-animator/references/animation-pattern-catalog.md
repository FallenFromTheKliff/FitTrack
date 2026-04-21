# Animation Pattern Catalog

Use this catalog to keep FitTrack motion deliberate, reusable, and evidence-backed. Prefer patterns here before searching for new ones.

## Motion principles

- Clarity over spectacle
- One motion voice per surface
- Noticeable but controlled intensity
- Structural motion before decorative motion
- Reduced-motion alternatives are mandatory

## Intensity bands

- `quiet`: supportive, low-amplitude, mostly for dense enterprise surfaces
- `noticeable`: visible and confident, the default premium band
- `bold`: used sparingly for premium emphasis, milestone, or high-value hero moments

## Page entrance and section reveal

### Fade rise

- `pattern_name`: Fade rise
- `best_for_components`: page shells, section containers, stat groups
- `intensity`: quiet
- `timing`: 180-240ms
- `easing`: ease-out
- `trigger`: first paint
- `anti_patterns`: giant travel distance, full-page theatrical staging
- `reference_sources`: Figma scaffold, Attio-like restraint
- `FitTrack adaptation`: use for initial admin-page composure

### Staggered section reveal

- `pattern_name`: Staggered section reveal
- `best_for_components`: stacked cards, dashboard bands, command panels
- `intensity`: noticeable
- `timing`: 200-280ms with 30-50ms offsets
- `easing`: ease-out
- `trigger`: first paint or mode switch
- `anti_patterns`: too many children, long cascading chains
- `reference_sources`: Aceternity text-generate and reveal rhythms, polished SaaS dashboards
- `FitTrack adaptation`: keep to 3-6 meaningful siblings max

### Mask or clip reveal

- `pattern_name`: Mask or clip reveal
- `best_for_components`: hero bands, chart panes, announcement rows
- `intensity`: noticeable
- `timing`: 220-320ms
- `easing`: ease-in-out
- `trigger`: first paint or state swap
- `anti_patterns`: using masks on dense lists or form-heavy pages
- `reference_sources`: premium landing systems, selective Figma showcase use
- `FitTrack adaptation`: reserve for high-value overview surfaces only

## List entrance, cascade, and stagger

### Row cascade

- `pattern_name`: Row cascade
- `best_for_components`: member rows, notification feeds, recent activity
- `intensity`: noticeable
- `timing`: 160-220ms with 20-35ms offsets
- `easing`: ease-out
- `trigger`: first data paint
- `anti_patterns`: replaying on every tiny query change
- `reference_sources`: Linear-like list restraint plus subtle motion
- `FitTrack adaptation`: use only on initial render or hard pagination changes

### Crossfade list refresh

- `pattern_name`: Crossfade list refresh
- `best_for_components`: table reloads, filtered lists, result refreshes
- `intensity`: quiet
- `timing`: 140-200ms
- `easing`: ease-out
- `trigger`: filter, sort, search, or refetch completion
- `anti_patterns`: full slide-outs for routine refreshes
- `reference_sources`: professional productivity tools
- `FitTrack adaptation`: default refresh pattern for dense admin lists

### Sliding pagination swap

- `pattern_name`: Sliding pagination swap
- `best_for_components`: numbered pagination, carousel-like result sets
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: smooth ease
- `trigger`: pagination click
- `anti_patterns`: long sideways travel, obvious content dislocation
- `reference_sources`: premium list interfaces, modern issue trackers
- `FitTrack adaptation`: short horizontal shift plus fade only

## Row hover, selection, press, and active-state emphasis

### Row hover highlight

- `pattern_name`: Row hover highlight
- `best_for_components`: tables, member lists, dense admin rows
- `intensity`: noticeable
- `timing`: 140-180ms
- `easing`: ease-out
- `trigger`: pointer enter or leave
- `anti_patterns`: giant scale, neon glows, parallax drift on rows
- `reference_sources`: Linear-inspired row emphasis
- `FitTrack adaptation`: pair subtle background lift with border and text contrast

### Selected row hold

- `pattern_name`: Selected row hold
- `best_for_components`: split-pane rows, selected list items, inspector launch rows
- `intensity`: noticeable
- `timing`: 160-220ms
- `easing`: ease-out
- `trigger`: row selection
- `anti_patterns`: selected rows that look identical to hover
- `reference_sources`: record surfaces like Attio
- `FitTrack adaptation`: selected state must outrank hover but stay calm

### Press compression

- `pattern_name`: Press compression
- `best_for_components`: buttons, clickable rows, icon actions
- `intensity`: quiet
- `timing`: 90-140ms
- `easing`: ease-out
- `trigger`: pointer down or tap
- `anti_patterns`: bouncy overshoot on enterprise controls
- `reference_sources`: modern product UI fundamentals
- `FitTrack adaptation`: apply broadly for responsiveness

## Card lift, hover glow, spotlight, border-gradient, and tilt

### Card lift

- `pattern_name`: Card lift
- `best_for_components`: cards, KPI tiles, compact preview blocks
- `intensity`: noticeable
- `timing`: 160-220ms
- `easing`: ease-out
- `trigger`: hover
- `anti_patterns`: large vertical jumps, exaggerated shadows
- `reference_sources`: premium SaaS cards
- `FitTrack adaptation`: prefer depth and contrast over height movement

### Focus glow

- `pattern_name`: Focus glow
- `best_for_components`: premium cards, selected panels, spotlight actions
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: ease-out
- `trigger`: hover, focus, or selection
- `anti_patterns`: permanent glow, neon borders, clashing colors
- `reference_sources`: Aceternity glow and spotlight patterns
- `FitTrack adaptation`: use brand accent carefully and only on priority surfaces

### Border gradient sweep

- `pattern_name`: Border gradient sweep
- `best_for_components`: hero cards, premium CTA cards, special status containers
- `intensity`: bold
- `timing`: 220-320ms
- `easing`: ease-in-out
- `trigger`: hover or state change
- `anti_patterns`: applying to every card on a dense admin surface
- `reference_sources`: Aceternity hover-border-gradient
- `FitTrack adaptation`: reserve for a few standout surfaces, not ordinary rows

### Tilt or perspective hover

- `pattern_name`: Tilt or perspective hover
- `best_for_components`: feature cards, marketing blocks, premium highlights
- `intensity`: bold
- `timing`: 180-260ms
- `easing`: spring or ease-out
- `trigger`: hover and pointer movement
- `anti_patterns`: use on tables, forms, or routine admin controls
- `reference_sources`: Aceternity 3D card patterns
- `FitTrack adaptation`: almost never for admin work; use only on showcase-like surfaces

## Button press, hover, loading, and success-confirm

### Primary button confidence

- `pattern_name`: Primary button confidence
- `best_for_components`: primary CTAs, form submit buttons
- `intensity`: noticeable
- `timing`: 140-180ms
- `easing`: ease-out
- `trigger`: hover and press
- `anti_patterns`: static buttons on high-value actions
- `reference_sources`: premium app fundamentals
- `FitTrack adaptation`: button should feel clickable and alive without wobble

### Loading morph

- `pattern_name`: Loading morph
- `best_for_components`: submit buttons, confirmation buttons
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: smooth ease
- `trigger`: pending state
- `anti_patterns`: abrupt text replacement with no feedback
- `reference_sources`: polished product forms
- `FitTrack adaptation`: shrink or lock width carefully so the button stays readable

### Success settle

- `pattern_name`: Success settle
- `best_for_components`: save buttons, confirmations, safe mutations
- `intensity`: noticeable
- `timing`: 220-320ms
- `easing`: ease-out
- `trigger`: success state
- `anti_patterns`: confetti for routine saves
- `reference_sources`: enterprise-grade form feedback
- `FitTrack adaptation`: icon, tint, and calm confirmation beat

## Chip, badge, filter, and segmented-control transitions

### Filter chip state flip

- `pattern_name`: Filter chip state flip
- `best_for_components`: chips, toggles, filter pills
- `intensity`: noticeable
- `timing`: 160-220ms
- `easing`: ease-out
- `trigger`: select or deselect
- `anti_patterns`: instant hard state snaps on premium pages
- `reference_sources`: polished SaaS filter systems
- `FitTrack adaptation`: background, border, and label weight should change together

### Segmented thumb slide

- `pattern_name`: Segmented thumb slide
- `best_for_components`: segmented controls, mode switches, density toggles
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: smooth ease
- `trigger`: segment change
- `anti_patterns`: delayed content update after the thumb moves
- `reference_sources`: premium control systems
- `FitTrack adaptation`: thumb motion and content swap should feel unified

### Badge emphasis pulse

- `pattern_name`: Badge emphasis pulse
- `best_for_components`: live badges, urgent status, milestone chips
- `intensity`: bold
- `timing`: 220-360ms
- `easing`: ease-out
- `trigger`: state escalation only
- `anti_patterns`: pulsing all status badges all the time
- `reference_sources`: alert UI patterns
- `FitTrack adaptation`: only for urgent or celebratory states

## Tab switches and content swaps

### Tab underline glide

- `pattern_name`: Tab underline glide
- `best_for_components`: tabs, top filters, sub-navigation
- `intensity`: noticeable
- `timing`: 180-220ms
- `easing`: smooth ease
- `trigger`: tab change
- `anti_patterns`: static tabs on premium control bars
- `reference_sources`: Aceternity tabs and polished productivity apps
- `FitTrack adaptation`: pair underline movement with content fade

### Content crossfade swap

- `pattern_name`: Content crossfade swap
- `best_for_components`: tab content, segmented panels, inspector sections
- `intensity`: quiet
- `timing`: 160-220ms
- `easing`: ease-out
- `trigger`: mode switch
- `anti_patterns`: sweeping full-panel slides for dense admin panels
- `reference_sources`: premium productivity suites
- `FitTrack adaptation`: prefer calm readability

## Search debounce and result-refresh transitions

### Search result settle

- `pattern_name`: Search result settle
- `best_for_components`: debounced search bars, list search
- `intensity`: quiet
- `timing`: 140-200ms
- `easing`: ease-out
- `trigger`: debounced result load
- `anti_patterns`: replaying full list entrance on every keystroke
- `reference_sources`: modern search UIs
- `FitTrack adaptation`: subtle opacity refresh is usually enough

### Query-state loader handoff

- `pattern_name`: Query-state loader handoff
- `best_for_components`: search inputs, filter bars, result panes
- `intensity`: noticeable
- `timing`: 160-220ms
- `easing`: ease-out
- `trigger`: pending to loaded
- `anti_patterns`: flickering between empty, loading, and loaded
- `reference_sources`: polished async UIs
- `FitTrack adaptation`: keep the layout anchored through the handoff

## Pagination transitions

### Numbered page emphasis

- `pattern_name`: Numbered page emphasis
- `best_for_components`: pagination pills or buttons
- `intensity`: noticeable
- `timing`: 140-180ms
- `easing`: ease-out
- `trigger`: page selection
- `anti_patterns`: active page that is barely distinguishable
- `reference_sources`: premium admin tables
- `FitTrack adaptation`: use stronger active contrast and press response

### Page-content slide and fade

- `pattern_name`: Page-content slide and fade
- `best_for_components`: paginated tables, card collections
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: smooth ease
- `trigger`: page change
- `anti_patterns`: full-screen horizontal travel
- `reference_sources`: premium data surfaces
- `FitTrack adaptation`: short offset only, maintain scan continuity

## Table sort, filter, sticky-header, and density transitions

### Sort indicator flip

- `pattern_name`: Sort indicator flip
- `best_for_components`: sortable columns, compact admin tables
- `intensity`: quiet
- `timing`: 120-160ms
- `easing`: ease-out
- `trigger`: sort change
- `anti_patterns`: invisible sort changes
- `reference_sources`: polished data tables
- `FitTrack adaptation`: tiny but clear icon change

### Sticky header settle

- `pattern_name`: Sticky header settle
- `best_for_components`: long tables, list headers
- `intensity`: quiet
- `timing`: 140-200ms
- `easing`: ease-out
- `trigger`: scroll threshold
- `anti_patterns`: sticky headers that slam in with no refinement
- `reference_sources`: premium enterprise data surfaces
- `FitTrack adaptation`: add subtle shadow and background change only

### Density toggle morph

- `pattern_name`: Density toggle morph
- `best_for_components`: compact versus comfortable list modes
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: ease-in-out
- `trigger`: density change
- `anti_patterns`: jarring hard reflow
- `reference_sources`: advanced data-product UIs
- `FitTrack adaptation`: keep text stable while row spacing transitions

## Form focus, inline validation, error, success, and confirmation states

### Focus ring bloom

- `pattern_name`: Focus ring bloom
- `best_for_components`: text inputs, selects, textareas
- `intensity`: quiet
- `timing`: 120-160ms
- `easing`: ease-out
- `trigger`: focus
- `anti_patterns`: static focus with no hierarchy improvement
- `reference_sources`: modern form systems
- `FitTrack adaptation`: use brand-aware but restrained focus styling

### Inline error reveal

- `pattern_name`: Inline error reveal
- `best_for_components`: form validation, field-level errors
- `intensity`: noticeable
- `timing`: 140-220ms
- `easing`: ease-out
- `trigger`: invalid state
- `anti_patterns`: instant red walls or shaking everything
- `reference_sources`: polished form design
- `FitTrack adaptation`: reveal message and border change together

### Confirm-state handoff

- `pattern_name`: Confirm-state handoff
- `best_for_components`: destructive confirmations, update confirmations
- `intensity`: noticeable
- `timing`: 180-260ms
- `easing`: smooth ease
- `trigger`: move from edit to confirm
- `anti_patterns`: abrupt dialog swaps with no continuity
- `reference_sources`: premium modal systems
- `FitTrack adaptation`: preserve context so the user feels safe

## Modal, drawer, inspector, and confirm-dialog reveal and dismiss

### Modal fade and rise

- `pattern_name`: Modal fade and rise
- `best_for_components`: standard dialogs, edit forms, confirmations
- `intensity`: noticeable
- `timing`: 220-300ms
- `easing`: ease-out
- `trigger`: open and close
- `anti_patterns`: hard pop-in, slow theatrical zooms
- `reference_sources`: premium product dialogs
- `FitTrack adaptation`: default modal pattern

### Drawer slide

- `pattern_name`: Drawer slide
- `best_for_components`: right-side drawers, slide-over panels, inspectors
- `intensity`: noticeable
- `timing`: 240-320ms
- `easing`: smooth ease
- `trigger`: open and close
- `anti_patterns`: overshooting spring, giant bounce
- `reference_sources`: modern productivity apps
- `FitTrack adaptation`: pair with backdrop fade and stable content lock

### Inspector crossfade

- `pattern_name`: Inspector crossfade
- `best_for_components`: split-pane inspectors, record previews
- `intensity`: quiet
- `timing`: 180-240ms
- `easing`: ease-out
- `trigger`: row change
- `anti_patterns`: full panel remount theatrics
- `reference_sources`: record-oriented admin UIs
- `FitTrack adaptation`: preserve inspector shell, swap content calmly

## Tooltip, popover, dropdown, and context-menu behavior

### Tooltip micro fade

- `pattern_name`: Tooltip micro fade
- `best_for_components`: tooltips, helper hints
- `intensity`: quiet
- `timing`: 100-140ms
- `easing`: ease-out
- `trigger`: hover or focus
- `anti_patterns`: big animated entrances for tiny hints
- `reference_sources`: interface basics
- `FitTrack adaptation`: keep subtle and quick

### Menu expand and settle

- `pattern_name`: Menu expand and settle
- `best_for_components`: dropdowns, action menus, context menus
- `intensity`: noticeable
- `timing`: 140-200ms
- `easing`: ease-out
- `trigger`: open and close
- `anti_patterns`: laggy menu springs
- `reference_sources`: polished menu systems
- `FitTrack adaptation`: couple scale and fade, not travel

## Toast and snackbar entry and exit

### Toast slide and fade

- `pattern_name`: Toast slide and fade
- `best_for_components`: success toasts, warnings, action feedback
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: ease-out
- `trigger`: toast mount and dismiss
- `anti_patterns`: gigantic travel distance, stacking chaos
- `reference_sources`: modern snackbar systems
- `FitTrack adaptation`: keep toast confident and fast

### Toast progress settle

- `pattern_name`: Toast progress settle
- `best_for_components`: dismissing snackbars with timeout
- `intensity`: quiet
- `timing`: duration-driven
- `easing`: linear for timer
- `trigger`: auto-dismiss
- `anti_patterns`: flashing timers
- `reference_sources`: productivity app snackbars
- `FitTrack adaptation`: useful for informative but non-blocking feedback

## Accordion and progressive disclosure

### Accordion height reveal

- `pattern_name`: Accordion height reveal
- `best_for_components`: FAQs, advanced filters, detail reveals
- `intensity`: noticeable
- `timing`: 180-240ms
- `easing`: ease-in-out
- `trigger`: expand and collapse
- `anti_patterns`: snapping open with no continuity
- `reference_sources`: polished disclosure components
- `FitTrack adaptation`: pair with chevron rotation and opacity ramp

### Inline detail fade

- `pattern_name`: Inline detail fade
- `best_for_components`: show-more patterns, expanded metadata rows
- `intensity`: quiet
- `timing`: 140-200ms
- `easing`: ease-out
- `trigger`: inline expansion
- `anti_patterns`: complex transforms for tiny detail blocks
- `reference_sources`: modern list disclosure
- `FitTrack adaptation`: ideal for secondary metadata on admin rows

## Skeleton, shimmer, and loading placeholders

### Skeleton pulse

- `pattern_name`: Skeleton pulse
- `best_for_components`: cards, rows, panels
- `intensity`: quiet
- `timing`: 1200-1800ms loop
- `easing`: ease-in-out
- `trigger`: loading state
- `anti_patterns`: sharp contrast flashes
- `reference_sources`: mainstream loading systems
- `FitTrack adaptation`: default low-drama loader

### Shimmer sweep

- `pattern_name`: Shimmer sweep
- `best_for_components`: premium-loading tables, hero cards
- `intensity`: noticeable
- `timing`: 1200-1800ms loop
- `easing`: linear
- `trigger`: loading state
- `anti_patterns`: overly bright shimmer or massive speed
- `reference_sources`: premium SaaS loaders
- `FitTrack adaptation`: reserve for key surfaces, not every placeholder

## Chart, stat, and trend emphasis

### Count-up settle

- `pattern_name`: Count-up settle
- `best_for_components`: KPIs, stat cards, summary chips
- `intensity`: noticeable
- `timing`: 600-1200ms
- `easing`: ease-out
- `trigger`: first paint or important refresh
- `anti_patterns`: re-running count-up on every tiny state change
- `reference_sources`: dashboard patterns
- `FitTrack adaptation`: use for major metrics only

### Trend-line draw

- `pattern_name`: Trend-line draw
- `best_for_components`: spark lines, lightweight analytics
- `intensity`: noticeable
- `timing`: 600-1200ms
- `easing`: ease-out
- `trigger`: first chart render
- `anti_patterns`: over-animating production analytics
- `reference_sources`: chart systems and polished dashboards
- `FitTrack adaptation`: one clean reveal is enough

## Milestone and reward motion

### Milestone burst

- `pattern_name`: Milestone burst
- `best_for_components`: milestone approval, streak continuation, achievement unlock
- `intensity`: bold
- `timing`: 260-420ms
- `easing`: ease-out or spring
- `trigger`: meaningful success only
- `anti_patterns`: using reward motion for routine saves
- `reference_sources`: celebratory UX patterns
- `FitTrack adaptation`: use sparingly and intentionally

### Success glow settle

- `pattern_name`: Success glow settle
- `best_for_components`: milestone cards, completed goals, safe confirmations
- `intensity`: noticeable
- `timing`: 220-320ms
- `easing`: ease-out
- `trigger`: meaningful completion
- `anti_patterns`: infinite glowing
- `reference_sources`: premium completion states
- `FitTrack adaptation`: better default than fireworks

## Background and ambient motion

### Gradient drift

- `pattern_name`: Gradient drift
- `best_for_components`: premium overview backgrounds, quiet hero zones
- `intensity`: quiet
- `timing`: 8-18s loop
- `easing`: linear or gentle ease-in-out
- `trigger`: always on
- `anti_patterns`: fast gradient animation on dense admin pages
- `reference_sources`: premium visual systems
- `FitTrack adaptation`: reserve for shell or hero backgrounds, not core data panes

### Particle drift

- `pattern_name`: Particle drift
- `best_for_components`: celebratory zones, branded ambient backgrounds
- `intensity`: bold
- `timing`: slow loop
- `easing`: linear
- `trigger`: always on
- `anti_patterns`: particles behind forms or tables
- `reference_sources`: showcase UI
- `FitTrack adaptation`: rarely appropriate on admin surfaces

### Spotlight hover ambient

- `pattern_name`: Spotlight hover ambient
- `best_for_components`: premium cards, hero zones, focus blocks
- `intensity`: noticeable
- `timing`: pointer-driven
- `easing`: smooth ease
- `trigger`: hover
- `anti_patterns`: applying to many dense siblings
- `reference_sources`: Aceternity spotlight and glow patterns
- `FitTrack adaptation`: use sparingly on standout blocks only

## Sticky rail or header collapse and reveal

### Sticky header compress

- `pattern_name`: Sticky header compress
- `best_for_components`: sticky top bars, dense admin headers
- `intensity`: quiet
- `timing`: 180-240ms
- `easing`: ease-out
- `trigger`: scroll threshold
- `anti_patterns`: giant disappearing headers with no continuity
- `reference_sources`: polished productivity suites
- `FitTrack adaptation`: reduce height and noise as the user commits to the task

### Rail collapse

- `pattern_name`: Rail collapse
- `best_for_components`: nav rails, sidebars, left navigation
- `intensity`: noticeable
- `timing`: 220-300ms
- `easing`: ease-in-out
- `trigger`: manual collapse or breakpoint
- `anti_patterns`: laggy width transitions tied to every hover
- `reference_sources`: professional app shells
- `FitTrack adaptation`: use when space recovery materially helps the surface

## Theme or skin transition behavior

### Theme fade bridge

- `pattern_name`: Theme fade bridge
- `best_for_components`: theme switches, skin changes, settings-driven look swaps
- `intensity`: quiet
- `timing`: 180-260ms
- `easing`: ease-out
- `trigger`: theme change
- `anti_patterns`: animating every token independently
- `reference_sources`: polished theme systems
- `FitTrack adaptation`: maintain readability first, personality second

## Disallowed combinations

- Tilt effects on dense tables
- Gradient sweeps on every card
- Particle systems behind forms or data grids
- Pulsing badges across ordinary status chips
- Full entrance cascades on every small refetch
- Long theatrical modal zooms on admin tools
- Multiple ambient effects competing on the same surface

