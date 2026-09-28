"use client";

import { useEffect } from "react";
import {
  PointerSensor,
  type PointerSensorProps,
} from "@dnd-kit/core";

type OwnerDocumentTarget = EventTarget & {
  ownerDocument?: Document | null;
};

type FacilityPointerDragCancel = () => void;

const activeFacilityPointerDrags = new Set<FacilityPointerDragCancel>();

function getOwnerDocument(target: EventTarget | null) {
  const ownerDocument = (target as OwnerDocumentTarget | null)?.ownerDocument;
  if (ownerDocument) return ownerDocument;
  return typeof document === "undefined" ? null : document;
}

function dispatchPointerCancel(ownerDocument: Document) {
  const ownerWindow = ownerDocument.defaultView;
  if (!ownerWindow) return;
  ownerDocument.dispatchEvent(
    new ownerWindow.Event("pointercancel", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

function cancelActiveFacilityPointerDrags() {
  Array.from(activeFacilityPointerDrags).forEach((cancel) => cancel());
  activeFacilityPointerDrags.clear();
}

/**
 * PointerSensor with cancellation for the browser lifecycle edges that do not
 * always emit pointercancel. The base sensor still owns dnd-kit activation,
 * click suppression, and listener teardown.
 */
export class FacilityPointerSensor extends PointerSensor {
  static activators = PointerSensor.activators;

  constructor(props: PointerSensorProps) {
    const ownerDocument = getOwnerDocument(props.event.target);
    let finished = false;
    let unregister: () => void = () => undefined;
    let removePlatformListeners: () => void = () => undefined;

    const finish = () => {
      if (finished) return;
      finished = true;
      removePlatformListeners();
      unregister();
    };

    const cancel = () => {
      if (finished) return;
      if (ownerDocument) dispatchPointerCancel(ownerDocument);
      // If the owner document was already detached during unmount, release
      // this wrapper's own listeners and registry entry anyway.
      finish();
    };

    super({
      ...props,
      onAbort: (id) => {
        finish();
        props.onAbort(id);
      },
      onCancel: () => {
        finish();
        props.onCancel();
      },
      onEnd: () => {
        finish();
        props.onEnd();
      },
    });

    if (finished) return;

    unregister = () => activeFacilityPointerDrags.delete(cancel);
    activeFacilityPointerDrags.add(cancel);

    const ownerWindow = ownerDocument?.defaultView;
    if (!ownerWindow || !ownerDocument) return;

    const handleBlur = () => cancel();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || finished) return;
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };

    ownerWindow.addEventListener("blur", handleBlur);
    ownerDocument.addEventListener("keydown", handleKeyDown, true);
    removePlatformListeners = () => {
      ownerWindow.removeEventListener("blur", handleBlur);
      ownerDocument.removeEventListener("keydown", handleKeyDown, true);
    };
  }
}

/** Cancel a pending/active facility pointer drag when its owning context changes. */
export function useFacilityPointerDragCancellation(cancelKey: unknown): void {
  useEffect(() => {
    return () => {
      cancelActiveFacilityPointerDrags();
    };
  }, [cancelKey]);
}
