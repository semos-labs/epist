<p align="center">
  <img src="images/Epist.png" alt="Epist" width="200">
</p>

<h1 align="center">Epist</h1>

<p align="center">
  <strong>Terminal email client with vim-style keybindings</strong><br>
  <em>Beautiful. Fast. Keyboard-driven.</em>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#keybindings">Keybindings</a> •
  <a href="#commands">Commands</a> •
  <a href="#configuration">Configuration</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Bun-1.0+-f9f1e1?logo=bun&logoColor=black" alt="Bun">
  <a href="https://github.com/semos-labs/aion/releases/latest"><img src="https://img.shields.io/github/downloads/semos-labs/epist/total?label=Downloads&color=blue" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
</p>

---

## Table of Contents

- [Why Epist?](#why-epist)
- [Quick Start](#quick-start)
- [Keybindings](#keybindings)
  - [Email List](#email-list)
  - [Email View](#email-view)
  - [Compose / Reply](#compose--reply)
  - [Folders & Labels](#folders--labels)
  - [General](#general)
- [Commands](#commands)
- [Configuration](#configuration)
- [Data Storage](#data-storage)
- [Tech Stack](#tech-stack)
- [Roadmap](#roadmap)

---

## Why Epist?

Most email clients are mouse-driven, bloated, and slow. Epist takes a different approach:

**Vim-style navigation. Terminal-native. Zero distractions.**

### Features

| Feature | Description |
|---------|-------------|
| **⌨️ Vim Keybindings** | Navigate with `j`/`k`, `gg`/`G`, `h`/`l` — feels like home |
| **📬 Two-Column Layout** | Email list on the left, full view on the right |
| **🔗 Gmail Sync** | Multi-account OAuth with PKCE, background sync every 10s |
| **🧵 Thread View** | Conversation threads with `[`/`]` to navigate between messages |
| **📂 Labels & Folders** | Dynamic labels fetched from Gmail with colored dots |
| **📁 Categories** | Collapsible Gmail categories (Social, Promotions, Updates, Forums) |
| **🔍 Two-Step Search** | Instant local filtering + remote Gmail search with debouncing |
| **📎 Attachments** | View, save, and open attachments — bulk save with `S` |
| **📅 Calendar Invites** | Auto-parse inline and `.ics` calendar invites with RSVP support |
| **✏️ Compose & Reply** | Full compose, reply, reply-all, forward, and quick inline reply |
| **⭐ Bulk Actions** | Select multiple threads with `x`, then archive, delete, or move |
| **↩️ Undo** | Undo the last action with `z` within a configurable timeout |
| **📝 Command Palette** | Quick access to all actions with `:` |
| **❓ Context Help** | Press `?` anywhere to see available keybindings |
| **💾 Local-First** | SQLite cache — your data stays yours, instant startup |
| **🎨 Themeable** | Customize colors via TOML configuration |
| **🚀 Fast** | Built with Bun and React — instant startup |

---

## Quick Start

### Option 1: Build from Source

```bash
git clone https://github.com/nicholasrq/epist.git
cd epist
bun install

# Run in development
bun dev

# Or run directly
bun start
```

### Set Up Google Cloud Credentials

Epist requires Google Cloud credentials to access Gmail. Here's how to set them up:

#### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable the **Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API" and click "Enable"
   - Also enable "Google Calendar API" and "People API" (for contacts)

#### Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (or Internal for Workspace)
   - Add your email as a test user
   - Add the following scopes:
     - `gmail.modify` (read/write mail and labels)
     - `gmail.send` (send mail)
     - `calendar.events` (read/write calendar events)
     - `calendar.readonly` (read calendars list)
     - `contacts.readonly` (read contacts)
     - `userinfo.email` and `userinfo.profile` (get user info)
4. Create OAuth client ID:
   - Application type: **Desktop app**
   - Name: "Epist" (or anything you like)
5. Copy the **Client ID** and **Client Secret**

#### Configure Epist

Add your credentials to `~/.config/epist/config.toml`:

```toml
[google]
clientId = "your-client-id.apps.googleusercontent.com"
clientSecret = "your-client-secret"
```

Or use environment variables:

```bash
export EPIST_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
export EPIST_GOOGLE_CLIENT_SECRET="your-client-secret"
```

### Connect Gmail

```
:login
```

Follow the OAuth flow in your browser. Epist supports multiple Google accounts.

### Navigate

Use `j`/`k` to move through emails, `Tab` to switch panes, `Enter` to open.

---

## Keybindings

### Email List

| Key | Action |
|-----|--------|
| `j` / `↓` | Next email |
| `k` / `↑` | Previous email |
| `gg` | First email |
| `G` | Last email |
| `Enter` / `Space` | Open email |
| `l` / `→` | View email |
| `Tab` / `` ` `` | Switch to view pane |
| `s` | Toggle star |
| `e` | Archive |
| `D` | Delete |
| `u` | Toggle read/unread |
| `r` | Reply |
| `R` | Reply all |
| `f` | Forward |
| `c` | Compose new |
| `m` | Move to folder |
| `x` | Toggle thread selection |
| `A` | Select all threads |
| `z` | Undo last action |
| `/` | Search emails |
| `:` | Open command bar |
| `?` | Show help |

### Email View

| Key | Action |
|-----|--------|
| `j` / `↓` | Scroll down |
| `k` / `↑` | Scroll up |
| `Ctrl+d` | Page down |
| `Ctrl+u` | Page up |
| `gg` | Scroll to top |
| `G` | Scroll to bottom |
| `h` / `←` / `Esc` | Back to list |
| `]` | Next message in thread |
| `[` | Previous message in thread |
| `Tab` | Next link |
| `Shift+Tab` | Previous link |
| `Enter` | Open link |
| `Q` | Quick inline reply |
| `i` | Toggle headers |
| `I` | Toggle image navigation |
| `a` | Toggle attachments |
| `s` | Toggle star |
| `e` | Archive |
| `D` | Delete |
| `r` | Reply |
| `R` | Reply all |
| `f` | Forward |
| `m` | Move to folder |
| `z` | Undo |

#### Calendar Invite RSVP

| Key | Action |
|-----|--------|
| `y` | Accept invite |
| `n` | Decline invite |
| `t` | Maybe / Tentative |

#### Attachment Navigation

| Key | Action |
|-----|--------|
| `j` / `k` | Navigate attachments |
| `Enter` / `o` | Open attachment |
| `s` | Save attachment |
| `S` | Save all attachments |

### Compose / Reply

| Key | Action |
|-----|--------|
| `Ctrl+s` | Send email |
| `Ctrl+f` | Toggle fullscreen |
| `Ctrl+b` | Toggle Cc/Bcc fields |
| `Ctrl+a` | Attach file |
| `Ctrl+g` | Manage attachments |
| `Esc` | Cancel |

### Inline Reply

| Key | Action |
|-----|--------|
| `Ctrl+s` | Send reply |
| `Ctrl+f` | Expand to full reply |
| `Esc` | Cancel |

### Folders & Labels

| Key | Action |
|-----|--------|
| `Ctrl+f` | Toggle folder sidebar |
| `j` / `k` | Navigate folders |
| `Space` / `→` | Toggle categories section |
| `←` | Collapse categories |
| `Esc` | Close sidebar |

### General

| Key | Action |
|-----|--------|
| `q` | Quit |
| `Ctrl+c` | Quit |
| `Ctrl+f` | Toggle folder sidebar |
| `:` | Open command palette |
| `/` | Search emails |
| `?` | Show help (context-aware) |

---

## Commands

Open the command palette with `:` and type a command:

### Email Management

| Command | Action |
|---------|--------|
| `archive` | Archive current email |
| `delete` | Delete current email |
| `star` | Toggle star |
| `unread` | Toggle read/unread |
| `move` | Move to folder |
| `undo` | Undo last action |

### Compose

| Command | Action |
|---------|--------|
| `compose` | Compose new email |
| `reply` | Reply to current email |
| `reply-all` | Reply all |
| `forward` | Forward current email |

### Navigation

| Command | Action |
|---------|--------|
| `search` | Search emails |

### Google Account

| Command | Action |
|---------|--------|
| `login` | Add Google account |
| `logout` | Remove all accounts |
| `profile` | Manage connected accounts |
| `sync` | Force sync with Gmail |
| `reset-sync` | Clear cache & full resync |

### General

| Command | Action |
|---------|--------|
| `help` | Show keybindings |
| `quit` | Exit application |

---

## Configuration

Create or edit `~/.config/epist/config.toml` to customize Epist:

```toml
# Epist — Terminal Email Client Configuration

# ===== General Settings =====
[general]
downloads_path = "~/Downloads"
auto_mark_read = true
auto_save_interval = 5  # seconds
undo_timeout = 5  # seconds

# ===== Email Signature =====
[signature]
enabled = true
text = """
--
Sent from Epist
"""

# ===== Theme =====
# Colors: black, red, green, yellow, blue, magenta, cyan, white, blackBright, etc.
[theme]
accent_color = "cyan"
header_bg = "white"
selected_bg = "blackBright"
starred_color = "yellow"
unread_style = "bold"  # bold, color, or both

# ===== Google OAuth =====
# Get credentials from https://console.cloud.google.com
[google]
clientId = ""
clientSecret = ""

# ===== Keybind Overrides =====
# Override default keybinds. Format: action = "key"
# Example: archive = "a"
[keybinds]

# ===== Accounts =====
# Per-account signature overrides the global signature
[[accounts]]
name = "Personal"
email = "me@example.com"
provider = "gmail"
is_default = true
```

---

## Data Storage

Epist follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html):

**Configuration** (`~/.config/epist/`):

| File | Description |
|------|-------------|
| `config.toml` | User configuration (Google credentials, theme, keybinds) |

**Data** (`~/.local/share/epist/`):

| File | Description |
|------|-------------|
| `epist.db` | SQLite database (emails, labels, sync state) |
| `accounts.json` | OAuth tokens and account info |
| `account-settings.json` | Custom account display names |
| `drafts/` | Saved email drafts |
| `logs/` | Application logs |

You can override XDG paths with environment variables:
- `XDG_CONFIG_HOME` (default: `~/.config`)
- `XDG_DATA_HOME` (default: `~/.local/share`)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | [Bun](https://bun.sh) |
| **UI Framework** | [Glyph](https://github.com/semos-labs/glyph) (React for terminals) |
| **State Management** | [Jotai](https://jotai.org) |
| **Database** | SQLite via [Drizzle ORM](https://orm.drizzle.team) |
| **Date/Time** | [Luxon](https://moment.github.io/luxon) |
| **NLP Dates** | [chrono-node](https://github.com/wanasit/chrono) |
| **HTML Rendering** | [Cheerio](https://cheerio.js.org) + [Turndown](https://github.com/mixmark-io/turndown) + [Marked](https://marked.js.org) |
| **Validation** | [Zod](https://zod.dev) |

---

## Roadmap

### ✅ Completed

- [x] Gmail sync via OAuth with PKCE
- [x] Multi-account support
- [x] Two-column layout (list + view)
- [x] Thread view with message navigation
- [x] Compose, reply, reply-all, forward
- [x] Quick inline reply
- [x] Dynamic Gmail labels & folders with colored dots
- [x] Collapsible Gmail categories
- [x] Two-step search (local + remote)
- [x] Attachment view, save, and open
- [x] Calendar invite parsing (inline + `.ics` attachments)
- [x] Calendar invite RSVP
- [x] Bulk selection & actions
- [x] Undo support
- [x] Move to folder picker
- [x] Star, archive, delete, mark read/unread
- [x] Command palette with fuzzy matching
- [x] Context-aware help dialog
- [x] Local SQLite cache with instant startup
- [x] Background sync (10s interval)
- [x] Image navigation mode
- [x] Link navigation with Tab
- [x] Configurable theme & keybinds
- [x] XDG Base Directory support
- [x] Draft auto-save

### 📋 Planned

- [ ] Homebrew distribution
- [ ] Downloadable binaries
- [ ] Offline mode improvements
- [ ] Contact auto-complete
- [ ] Email templates
- [ ] PGP/GPG encryption

---

## License

MIT © 2025

---

<p align="center">
  <sub>Built with ⌨️ for terminal lovers</sub>
</p>
