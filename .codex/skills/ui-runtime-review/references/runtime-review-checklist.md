# Runtime Review Checklist

## Always test

- row or card hover
- row or card selection
- pagination transition
- main filter or tab switch
- modal, drawer, or inspector open and close
- one safe confirm flow when available

## Test when present

- inline validation
- toast or snackbar feedback
- loading and empty states
- sticky header or sticky footer behavior
- background or ambient motion

## Fail when

- two primary overlays are active
- the wrong surface owns scroll
- motion is inconsistent by zone
- ambient motion distracts from the task
- validation or error feedback is hidden or weak

