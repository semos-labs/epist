import React from "react";
import { HelpDialog as GlyphHelpDialog } from "@semos-labs/glyph";
import { useAtomValue, useSetAtom } from "jotai";
import { focusAtom, overlayStackAtom, type FocusContext } from "../state/atoms.ts";
import { popOverlayAtom } from "../state/actions.ts";
import { registry, SCOPE_TITLES, RELATED_SCOPES, type KeybindScope } from "../keybinds/registry.ts";

export function HelpDialog() {
  const focus = useAtomValue(focusAtom);
  const overlayStack = useAtomValue(overlayStackAtom);
  const popOverlay = useSetAtom(popOverlayAtom);

  // Get the previous focus context (before help was opened)
  const helpOverlay = overlayStack.find((o) => o.kind === "help");
  const contextFocus = (helpOverlay?.prevFocus || focus) as KeybindScope;

  return (
    <GlyphHelpDialog
      registry={registry}
      context={contextFocus}
      helpOptions={{
        scopeTitles: SCOPE_TITLES,
        related: RELATED_SCOPES[contextFocus],
      }}
      open={!!helpOverlay}
      onClose={() => popOverlay()}
      toggleKey={null}
      width={55}
      keyColumnWidth={14}
    />
  );
}
