# ✉ Epist

A terminal-based email client built with [Glyph](https://github.com/nick-skriabin/glyph) - beautiful, fast, and fully keyboard-driven.

```
┌─────────────────────────────────────────────────────────────────┐
│ ✉ EPIST │ Inbox ◀                    j/k:nav Tab:switch ?:help │
├─────────────────────────────────────────────────────────────────┤
│ ▶ Inbox           2/10 │ ★ Q1 2026 Product Roadmap Review      │
│ ▸★Sarah Chen  Q1 2026… │                                       │
│   Marcus Johnson Re:… │ From: Sarah Chen                       │
│   Cloud Services Inv… │ To:   You                              │
│   GitHub GitHub: [pr… │ Date: Tuesday, February 10             │
│   Sky Airlines Your … │                                        │
│                       │ Hi team,                                │
│                       │                                         │
│                       │ I wanted to share the updated roadmap… │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Two-column layout**: Email list on the left, full view on the right
- **Vim-style navigation**: `j/k` to move, `gg/G` for first/last
- **Command bar**: Press `:` to open, type commands directly
- **Search**: Press `/` to search emails
- **Keyboard-driven**: No mouse required

## Quick Start

```bash
# Install dependencies
bun install

# Run the application
bun run start

# Or in development mode with watch
bun run dev
```

## Keybindings

### Navigation
| Key | Action |
|-----|--------|
| `j` / `↓` | Next item |
| `k` / `↑` | Previous item |
| `gg` | First item |
| `G` | Last item |
| `Tab` / `` ` `` | Switch focus between list and view |
| `h` / `←` | Back to list (in view) |
| `l` / `→` | Open email view |
| `Enter` | Open/Select |

### Email Actions
| Key | Action |
|-----|--------|
| `s` | Toggle star |
| `e` | Archive |
| `D` | Delete |
| `u` | Mark as unread |
| `r` | Reply |
| `f` | Forward |
| `c` | Compose new |

### Global
| Key | Action |
|-----|--------|
| `:` | Open command bar |
| `/` | Search emails |
| `?` | Show help |
| `q` | Quit |

## Commands

Type `:` to open the command bar, then enter commands:

- `inbox` - Go to Inbox
- `sent` - Go to Sent
- `drafts` - Go to Drafts
- `trash` - Go to Trash
- `starred` - Go to Starred
- `archive` - Archive current email
- `delete` - Delete current email
- `star` - Toggle star
- `help` - Show keyboard shortcuts
- `quit` - Exit application

## Tech Stack

- **UI Framework**: [Glyph](https://github.com/nick-skriabin/glyph) - React-based terminal UI
- **State Management**: [Jotai](https://jotai.org/) - Primitive atomic state
- **Runtime**: [Bun](https://bun.sh/) - Fast JavaScript runtime
- **Language**: TypeScript
- **Schema Validation**: Zod
- **Date Handling**: Luxon + chrono-node
- **Search**: Lunr (planned)
- **Database**: SQLite with Drizzle (planned)

## Project Structure

```
src/
├── domain/          # Business logic and types
│   ├── email.ts     # Email types and helpers
│   └── time.ts      # Date formatting utilities
├── keybinds/        # Keyboard handling
│   ├── registry.ts  # Centralized keybind definitions
│   └── useKeybinds.tsx
├── mock/            # Mock data for development
│   └── emails.ts
├── state/           # Jotai atoms and actions
│   ├── atoms.ts     # State definitions
│   └── actions.ts   # State mutations
├── ui/              # React components
│   ├── App.tsx      # Main application
│   ├── EmailList.tsx
│   ├── EmailView.tsx
│   ├── StatusBar.tsx
│   ├── CommandPalette.tsx
│   └── HelpDialog.tsx
└── index.tsx        # Entry point
```

## Roadmap

- [ ] Actual email integration (IMAP/SMTP)
- [ ] SQLite persistence with Drizzle
- [ ] Full-text search with Lunr
- [ ] Compose/Reply/Forward
- [ ] Account management
- [ ] Thread view
- [ ] Attachments handling
- [ ] Natural language date parsing
- [ ] Multiple accounts

## License

MIT
