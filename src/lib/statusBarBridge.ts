import type { StatusBarMessage } from "@semos-labs/glyph";

/**
 * Bridge between Jotai atoms (non-React context) and glyph's StatusBar message system.
 *
 * A React component inside the StatusBar tree calls `setStatusBarRef` with the
 * `showMessage` / `clearMessage` functions from `useStatusBar()`. Atom write
 * functions then call `showStatusBarMessage` / `clearStatusBarMessage` to post
 * messages without needing React hooks.
 */

let _showMessage: ((msg: StatusBarMessage | string) => void) | null = null;
let _clearMessage: (() => void) | null = null;

export function setStatusBarRef(
  showMessage: typeof _showMessage,
  clearMessage: typeof _clearMessage,
) {
  _showMessage = showMessage;
  _clearMessage = clearMessage;
}

export function showStatusBarMessage(msg: StatusBarMessage | string) {
  _showMessage?.(msg);
}

export function clearStatusBarMessage() {
  _clearMessage?.();
}
