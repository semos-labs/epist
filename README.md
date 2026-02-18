<p align="center">
  <img src="images/Epist.png" alt="Epist" width="200">
</p>

<h1 align="center">Epist</h1>

<p align="center">
  <strong>Terminal email client with vim-style keybindings</strong>
</p>

<p align="center">
  <a href="https://github.com/semos-labs/epist/releases/latest"><img src="https://img.shields.io/github/v/release/semos-labs/epist?label=Release&amp;color=green" alt="Latest Release"></a>
  <a href="https://github.com/semos-labs/epist/releases/latest"><img src="https://img.shields.io/github/downloads/semos-labs/epist/total?label=Downloads&amp;color=blue&amp;v=1" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/Bun-1.0+-f9f1e1?logo=bun&amp;logoColor=black" alt="Bun">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
  <a href="https://github.com/semos-labs/glyph"><img src="https://img.shields.io/badge/Built_with-Glyph-bd93f9" alt="Built with Glyph"></a>
</p>

<p align="center">
  <a href="#why-epist">Why Epist</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#keybindings">Keybindings</a> &bull;
  <a href="#commands">Commands</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#comparison">Comparison</a>
</p>

---

Epist is a keyboard-driven email client for the terminal, built with [**Glyph**](https://github.com/semos-labs/glyph). Gmail OAuth + IMAP/SMTP, two-column layout, threaded conversations — manage your inbox without leaving the terminal.

<p align="center">
  <img src="images/app.jpg" alt="Epist in action" width="800">
  <br>
  <sub>Inbox view — email list on the left, full message on the right</sub>
</p>

---

## Why Epist

Built for people who live in the terminal and want email to feel like `vim`, not like a web browser.

- **Vim keybindings** — `j`/`k`, `gg`/`G`, `h`/`l`, `/` to search, `:` for commands. Feels like home.
- **Two-column layout** — email list on the left, full view on the right. No pane juggling.
- **Gmail + IMAP/SMTP** — Gmail OAuth with PKCE *and* generic IMAP/SMTP. Use any provider, mix both.
- **Secure credentials** — `password_command` integration with Keychain, `pass`, 1Password CLI, Bitwarden, env vars.
- **Threads & labels** — conversation threading with `[`/`]`, Gmail labels with colored dots, collapsible categories.
- **Two-step search** — instant local filtering + remote search with debouncing.
- **Compose & reply** — full compose, reply, reply-all, forward, and quick inline reply with contact autocomplete.
- **Attachments & calendar** — view/save/open attachments, parse `.ics` invites with RSVP support.
- **Bulk actions & undo** — select multiple threads with `x`, act on many, undo with `z`.
- **Command palette** — fuzzy-matched command bar (`:`) and context-aware help (`?`).
- **Local-first** — SQLite cache, instant startup, your data stays yours.
- **Themeable** — customize colors via TOML configuration.

[Full comparison with other terminal email clients →](#comparison)

---

## Quick Start

### Homebrew (macOS / Linux)

```bash
brew tap semos-labs/tap
brew install epist
```

### Build from Source

```bash
git clone https://github.com/semos-labs/epist.git
cd epist && bun install
bun dev        # development
bun start      # production
```

---

## Setup

Epist supports **Gmail (OAuth)** and **IMAP/SMTP** (any email provider). You can use both simultaneously.

### IMAP/SMTP (Any Provider)

Add your account to `~/.config/epist/config.toml`:

```toml
[[accounts]]
name = "Work"
email = "me@work.com"
provider = "imap"

[accounts.imap]
host = "imap.work.com"
port = 993
security = "tls"
username = "me@work.com"
password_command = "security find-generic-password -a me@work.com -s epist -w"

[accounts.smtp]
host = "smtp.work.com"
port = 587
security = "starttls"
username = "me@work.com"
password_command = "security find-generic-password -a me@work.com -s epist -w"
```

**Password options:**

| Method | Example |
|--------|---------|
| macOS Keychain | `password_command = "security find-generic-password -a me@work.com -s epist -w"` |
| `pass` (GPG) | `password_command = "pass show email/work"` |
| 1Password CLI | `password_command = "op read op://Personal/WorkEmail/password"` |
| Bitwarden CLI | `password_command = "bw get password work-email"` |
| Environment var | `password_command = "echo $WORK_EMAIL_PASSWORD"` |
| Plain text | `password = "hunter2"` *(not recommended)* |

You can add multiple `[[accounts]]` blocks for multiple IMAP/SMTP accounts.

### Gmail (OAuth)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project
2. Enable **Gmail API**, **Google Calendar API**, and **People API**
3. Go to "APIs & Services" → "Credentials" → "Create Credentials" → "OAuth client ID"
4. Configure OAuth consent screen:
   - User Type: **External** (or Internal for Workspace)
   - Add your email as a test user
   - Scopes: `gmail.modify`, `gmail.send`, `calendar.events`, `calendar.readonly`, `contacts.readonly`, `userinfo.email`, `userinfo.profile`
5. Create OAuth client ID — Application type: **Desktop app**
6. Copy the **Client ID** and **Client Secret**

Add credentials to `~/.config/epist/config.toml`:

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

Then connect:

```
:login
```

Follow the OAuth flow in your browser. Epist supports multiple Google accounts — IMAP accounts are loaded automatically from `config.toml`.

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

| Command | Action |
|---------|--------|
| `archive` | Archive current email |
| `delete` | Delete current email |
| `star` | Toggle star |
| `unread` | Toggle read/unread |
| `move` | Move to folder |
| `undo` | Undo last action |
| `compose` | Compose new email |
| `reply` | Reply to current email |
| `reply-all` | Reply all |
| `forward` | Forward current email |
| `search` | Search emails |
| `login` | Add Google account (OAuth) |
| `logout` | Remove all accounts |
| `profile` | Manage connected accounts (Gmail + IMAP) |
| `sync` | Force sync with server |
| `reset-sync` | Clear cache & full resync |
| `help` | Show keybindings |
| `quit` | Exit application |

---

## Configuration

Create or edit `~/.config/epist/config.toml`:

```toml
[general]
downloads_path = "~/Downloads"
auto_mark_read = true
auto_save_interval = 5        # seconds
undo_timeout = 5              # seconds

[signature]
enabled = true
text = """
--
Sent from Epist
"""

# Colors: black, red, green, yellow, blue, magenta, cyan, white, blackBright, etc.
[theme]
accent_color = "cyan"
header_bg = "white"
selected_bg = "blackBright"
starred_color = "yellow"
unread_style = "bold"         # bold, color, or both

[google]
clientId = ""
clientSecret = ""

[keybinds]
# Override defaults: action = "key"

# Gmail account (uses OAuth — run :login to authenticate)
[[accounts]]
name = "Personal"
email = "me@example.com"
provider = "gmail"
is_default = true

# IMAP/SMTP account (any email provider)
[[accounts]]
name = "Work"
email = "me@work.com"
provider = "imap"
signature = "--\nSent from my work account"

[accounts.imap]
host = "imap.work.com"
port = 993
security = "tls"              # "tls" (993), "starttls" (143), or "none"
username = "me@work.com"
password_command = "pass show email/work"

[accounts.smtp]
host = "smtp.work.com"
port = 587
security = "starttls"         # "tls" (465), "starttls" (587), or "none"
username = "me@work.com"
password_command = "pass show email/work"
```

---

## Data Storage

Epist follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html):

**Configuration** (`~/.config/epist/`): `config.toml` — accounts, credentials, theme, keybinds.

**Data** (`~/.local/share/epist/`):

| File | Description |
|------|-------------|
| `epist.db` | SQLite database (emails, labels, sync state) |
| `accounts.json` | OAuth tokens and account info |
| `account-settings.json` | Custom account display names |
| `drafts/` | Saved email drafts |
| `logs/` | Application logs |

Override with `XDG_CONFIG_HOME` and `XDG_DATA_HOME` environment variables.

---

## Comparison

Side-by-side with other terminal email clients:

| Feature | Epist | [NeoMutt](https://neomutt.org) | [aerc](https://aerc-mail.org) | [Himalaya](https://github.com/pimalaya/himalaya) | [Alpine](https://alpineapp.email) | [meli](https://meli-email.org) |
|---------|:-----:|:-------:|:----:|:--------:|:------:|:----:|
| **Protocol** | Gmail API + IMAP/SMTP | IMAP/POP3/SMTP | IMAP/SMTP/Notmuch | IMAP/SMTP | IMAP/POP3/SMTP | IMAP/Notmuch/Maildir |
| **Gmail OAuth (built-in)** | ✅ | ❌¹ | ⚠️² | ⚠️² | ❌ | ❌ |
| **IMAP/SMTP support** | ✅ Any provider | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Setup complexity** | `brew install` + `:login` | Extensive `.muttrc` config | Moderate config files | Moderate config | Menu-driven setup | TOML config |
| **Secure credentials** | ✅ `password_command` | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Vim keybindings** | ✅ Out of the box | ✅ Customizable | ✅ Inspired | ❌ CLI only | ❌ Menu-driven | ⚠️ Partial |
| **Two-column layout** | ✅ List + preview | ❌ Single pane | ❌ Single pane | ❌ CLI only | ❌ Single pane | ✅ |
| **Thread view** | ✅ Navigate with `[`/`]` | ✅ | ✅ | ⚠️ Basic | ✅ | ✅ |
| **Multi-account** | ✅ Mix Gmail + IMAP | ✅ Complex config | ✅ | ✅ | ✅ | ✅ |
| **Calendar invites (ICS)** | ✅ Parse + RSVP | ❌ | ⚠️ View only | ❌ | ❌ | ❌ |
| **Contact autocomplete** | ✅ From history | ✅ With aliases | ✅ | ❌ | ✅ | ❌ |
| **Local cache / offline** | ✅ SQLite | ⚠️ Header cache | ❌ | ❌ | ❌ | ⚠️ Maildir |
| **Search** | ✅ Local + remote | ✅ With notmuch | ✅ | ✅ Basic | ✅ | ✅ With notmuch |
| **Gmail labels & categories** | ✅ Colored dots | ⚠️ Via IMAP folders | ⚠️ Via IMAP folders | ⚠️ Via IMAP folders | ⚠️ Via IMAP folders | ⚠️ Via IMAP folders |
| **Undo actions** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Command palette** | ✅ Fuzzy matching | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Inline quick reply** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Context-aware help** | ✅ Press `?` anywhere | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Bulk actions** | ✅ Select + act | ✅ Tag patterns | ✅ | ❌ | ✅ | ✅ |
| **Themeable** | ✅ TOML config | ✅ `.muttrc` | ✅ `stylesets` | ❌ | ✅ Limited | ✅ Themes |
| **Written in** | TypeScript (Bun) | C | Go | Rust | C | Rust |

<sup>¹ Requires external helper scripts (e.g. `oauth2.py`) or app-specific passwords</sup><br>
<sup>² Supports OAuth via external credential commands, requires manual setup</sup>

> **TL;DR** — Epist is built for people who want a **modern, keyboard-driven** terminal email experience with **zero friction**. Gmail users get one-command OAuth setup. IMAP/SMTP users get secure `password_command` integration with any secret manager. Mix both in a single client.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| **Runtime** | [Bun](https://bun.sh) |
| **UI Framework** | [**Glyph**](https://github.com/semos-labs/glyph) — React renderer for terminal UIs |
| **State Management** | [Jotai](https://jotai.org) |
| **Database** | SQLite via [Drizzle ORM](https://orm.drizzle.team) |
| **IMAP** | [ImapFlow](https://imapflow.com) |
| **SMTP** | [Nodemailer](https://nodemailer.com) |
| **MIME Parsing** | [Mailparser](https://nodemailer.com/extras/mailparser/) |
| **Date/Time** | [Luxon](https://moment.github.io/luxon) |
| **NLP Dates** | [chrono-node](https://github.com/wanasit/chrono) |
| **HTML Rendering** | [Cheerio](https://cheerio.js.org) + [Turndown](https://github.com/mixmark-io/turndown) + [Marked](https://marked.js.org) |
| **Validation** | [Zod](https://zod.dev) |

---

## Roadmap

### ✅ Completed

- [x] Gmail sync via OAuth with PKCE
- [x] IMAP/SMTP support (any email provider)
- [x] Secure credentials via `password_command`
- [x] Multi-account support (mix Gmail + IMAP)
- [x] Two-column layout (list + view)
- [x] Thread view with message navigation
- [x] Compose, reply, reply-all, forward
- [x] Quick inline reply
- [x] Contact autocomplete from email history
- [x] Dynamic Gmail labels & folders with colored dots
- [x] IMAP folder auto-discovery (special-use flags + name heuristics)
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
- [x] Homebrew distribution

### 📋 Planned

- [ ] Downloadable binaries
- [ ] Offline mode improvements
- [ ] IMAP IDLE push notifications
- [ ] Email templates
- [ ] PGP/GPG encryption

---

## License

MIT © 2025

---

<p align="center">
  <sub>Built with <a href="https://github.com/semos-labs/glyph"><strong>Glyph</strong></a> &bull; React &bull; a lot of ANSI escape codes</sub>
</p>
