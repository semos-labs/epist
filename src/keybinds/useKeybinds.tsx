import React from "react";
import { Keybind } from "@nick-skriabin/glyph";
import { KEYBIND_REGISTRY, type KeybindScope } from "./registry.ts";

interface KeybindHandlers {
  [action: string]: () => void;
}

interface UseKeybindsProps {
  scope: KeybindScope;
  handlers: KeybindHandlers;
  enabled?: boolean;
}

// Component to render keybinds for a scope
export function ScopedKeybinds({ scope, handlers, enabled = true }: UseKeybindsProps) {
  if (!enabled) return null;
  
  const keybinds = KEYBIND_REGISTRY[scope] || [];
  
  return (
    <>
      {keybinds.map((kb, index) => {
        const handler = handlers[kb.action];
        if (!handler || !kb.key) return null;
        
        return (
          <Keybind
            key={`${scope}-${kb.key}-${index}`}
            keypress={kb.key}
            onPress={handler}
          />
        );
      })}
    </>
  );
}

// Handle key event through registry
export function handleKeyEvent(
  scope: KeybindScope,
  key: { name: string; shift?: boolean; ctrl?: boolean; meta?: boolean; sequence?: string },
  handlers: KeybindHandlers
): boolean {
  const keybinds = KEYBIND_REGISTRY[scope] || [];
  
  for (const kb of keybinds) {
    if (matchKey(kb.key, key)) {
      const handler = handlers[kb.action];
      if (handler) {
        handler();
        return true;
      }
    }
  }
  
  return false;
}

// Match key definition against key event
function matchKey(
  keyDef: string,
  key: { name: string; shift?: boolean; ctrl?: boolean; meta?: boolean; sequence?: string }
): boolean {
  if (!keyDef) return false;
  
  const parts = keyDef.toLowerCase().split("+");
  const keyName = parts.pop() || "";
  const modifiers = new Set(parts);
  
  // Check modifiers
  if (modifiers.has("shift") !== !!key.shift) return false;
  if (modifiers.has("ctrl") !== !!key.ctrl) return false;
  if (modifiers.has("meta") !== !!key.meta) return false;
  
  // Normalize: registry uses "space" but Glyph sends " "
  const normalizedKeyName = keyName === "space" ? " " : keyName;
  
  // Check key name
  const eventKey = key.name?.toLowerCase() || key.sequence?.toLowerCase() || "";
  return eventKey === normalizedKeyName;
}
