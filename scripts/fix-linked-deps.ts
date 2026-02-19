/**
 * Bun preload plugin: fix duplicate dependencies from `bun link`.
 *
 * When `@semos-labs/glyph` is linked via `bun link`, Bun resolves
 * the symlink to the real path and looks up `react` from *glyph's*
 * node_modules — giving us two separate React instances (one from
 * epist, one from glyph).  Two Reacts = hooks crash, broken context,
 * etc.
 *
 * This plugin intercepts all `react` imports and forces them to
 * resolve from the *project root* (epist), ensuring a single
 * React instance across the entire process.
 *
 * Usage:
 *   1. bun link @semos-labs/glyph
 *   2. Add to bunfig.toml:  preload = ["./scripts/fix-linked-deps.ts"]
 *   3. Run normally:         bun run dev
 */
import { plugin } from "bun";

const projectRoot = import.meta.dir + "/..";

plugin({
  name: "fix-linked-deps",
  setup(build) {
    // Force `react` and `react/*` (e.g. react/jsx-runtime) to resolve
    // from the project root, not from the linked package's real path.
    build.onResolve({ filter: /^react(\/.*)?$/ }, (args) => {
      return {
        path: require.resolve(args.path, { paths: [projectRoot] }),
      };
    });
  },
});
