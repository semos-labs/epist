import React from "react";
import { Keybind } from "@semos-labs/glyph";
import { KEYBIND_REGISTRY, type KeybindScope } from "./registry.ts";

type ActionHandlers = Record<string, (() => void) | undefined>;

/**
 * Renders Keybind components for all keybinds in a scope that have handlers.
 * 
 * Usage:
 *   <ScopedKeybinds scope="list" handlers={{ nextEmail: moveDown, prevEmail: moveUp }} />
 */
export function ScopedKeybinds({
  scope,
  handlers,
  enabled = true,
  priority = false,
}: {
  scope: KeybindScope;
  handlers: ActionHandlers;
  enabled?: boolean;
  priority?: boolean;
}) {
  if (!enabled) return null;

  const keybinds = KEYBIND_REGISTRY[scope] || [];

  return (
    <>
      {keybinds
        .filter((kb) => kb.key && handlers[kb.action])
        .map((kb, i) => (
          <Keybind
            key={`${scope}-${kb.key}-${i}`}
            keypress={kb.key}
            onPress={handlers[kb.action]!}
            priority={priority}
          />
        ))}
    </>
  );
}
