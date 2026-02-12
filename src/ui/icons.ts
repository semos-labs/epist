// Icon system with Nerd Font support and ASCII fallback
// Enable nerd fonts by setting EPIST_NERD_FONTS=1

const USE_NERD_FONTS = process.env.EPIST_NERD_FONTS === "1";

// Nerd Font codepoints (using Unicode escape sequences for reliability)
const nf = {
  star: "\uf005",        // nf-fa-star
  starEmpty: "\uf006",   // nf-fa-star_o  
  paperclip: "\uf0c6",   // nf-fa-paperclip
  chevronRight: "\uf054", // nf-fa-chevron_right
  chevronUp: "\uf077",   // nf-fa-chevron_up
  chevronDown: "\uf078", // nf-fa-chevron_down
  envelope: "\uf0e0",    // nf-fa-envelope
  reply: "\uf112",       // nf-fa-reply
  share: "\uf064",       // nf-fa-share (forward)
  archive: "\uf187",     // nf-fa-archive
  trash: "\uf1f8",       // nf-fa-trash
  circle: "\uf111",      // nf-fa-circle
  circleO: "\uf10c",     // nf-fa-circle_o
  search: "\uf002",      // nf-fa-search
  terminal: "\uf120",    // nf-fa-terminal
  question: "\uf128",    // nf-fa-question
  folder: "\uf07b",      // nf-fa-folder
  folderOpen: "\uf07c",  // nf-fa-folder_open
  send: "\uf1d8",        // nf-fa-paper_plane
  file: "\uf15b",        // nf-fa-file
  bolt: "\uf0e7",        // nf-fa-bolt (for new)
  expand: "\uf065",      // nf-fa-expand
  compress: "\uf066",    // nf-fa-compress
  close: "\uf00d",       // nf-fa-close
  minus: "\uf068",       // nf-fa-minus (minimize)
  image: "\uf03e",       // nf-fa-image
  imagePlaceholder: "\uf1c5", // nf-fa-file_image_o
  calendar: "\uf073",    // nf-fa-calendar
  check: "\uf00c",       // nf-fa-check
  cross: "\uf00d",       // nf-fa-times
  link: "\uf0c1",        // nf-fa-link
  people: "\uf0c0",      // nf-fa-users
  location: "\uf041",    // nf-fa-map_marker
  clock: "\uf017",       // nf-fa-clock_o
};

export const icons = {
  // Email list
  new: USE_NERD_FONTS ? ` ${nf.bolt}` : " new",
  star: USE_NERD_FONTS ? nf.star : "*",
  starEmpty: " ",
  attachment: USE_NERD_FONTS ? nf.paperclip : "@",
  
  // Navigation
  selected: USE_NERD_FONTS ? nf.chevronRight : ">",
  
  // Email view
  mail: USE_NERD_FONTS ? nf.envelope : "✉",
  reply: USE_NERD_FONTS ? nf.reply : "↩",
  forward: USE_NERD_FONTS ? nf.share : "→",
  archive: USE_NERD_FONTS ? nf.archive : "⌫",
  trash: USE_NERD_FONTS ? nf.trash : "×",
  
  // Status
  unread: USE_NERD_FONTS ? nf.circle : "●",
  read: USE_NERD_FONTS ? nf.circleO : "○",
  
  // UI elements
  arrowUp: USE_NERD_FONTS ? nf.chevronUp : "↑",
  arrowDown: USE_NERD_FONTS ? nf.chevronDown : "↓",
  search: USE_NERD_FONTS ? nf.search : "/",
  command: USE_NERD_FONTS ? nf.terminal : ":",
  help: USE_NERD_FONTS ? nf.question : "?",
  
  // Folders/Labels
  inbox: USE_NERD_FONTS ? nf.envelope : "▸",
  sent: USE_NERD_FONTS ? nf.send : "▸",
  drafts: USE_NERD_FONTS ? nf.file : "▸",
  folder: USE_NERD_FONTS ? nf.folder : "▸",
  
  // Window controls
  expand: USE_NERD_FONTS ? nf.expand : "□",
  compress: USE_NERD_FONTS ? nf.compress : "▫",
  close: USE_NERD_FONTS ? nf.close : "×",
  minimize: USE_NERD_FONTS ? nf.minus : "−",
  image: USE_NERD_FONTS ? nf.image : "⬚",
  calendar: USE_NERD_FONTS ? nf.calendar : "📅",
  check: USE_NERD_FONTS ? nf.check : "✓",
  cross: USE_NERD_FONTS ? nf.cross : "✗",
  question: USE_NERD_FONTS ? nf.question : "?",
  link: USE_NERD_FONTS ? nf.link : "🔗",
  people: USE_NERD_FONTS ? nf.people : "👥",
  location: USE_NERD_FONTS ? nf.location : "📍",
  clock: USE_NERD_FONTS ? nf.clock : "🕐",
} as const;

export type IconName = keyof typeof icons;

// Helper to check if nerd fonts are enabled
export const hasNerdFonts = USE_NERD_FONTS;
