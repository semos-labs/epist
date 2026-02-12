import type { Email } from "../domain/email.ts";
import { DateTime } from "luxon";

// Generate realistic mock emails
export const mockEmails: Email[] = [
  {
    id: "email-001",
    threadId: "thread-001",
    subject: "Q1 2026 Product Roadmap Review",
    from: { email: "sarah.chen@techcorp.io", name: "Sarah Chen" },
    to: [{ email: "me@example.com", name: "You" }],
    cc: [
      { email: "alex.kumar@techcorp.io", name: "Alex Kumar" },
      { email: "team-leads@techcorp.io", name: "Team Leads" },
    ],
    messageId: "<roadmap-q1-2026@techcorp.io>",
    date: DateTime.now().minus({ hours: 2 }).toISO()!,
    body: "Hi team, I wanted to share the updated roadmap for Q1 2026.",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><style>body { font-family: Arial, sans-serif; color: #333; } .container { max-width: 600px; margin: 0 auto; } h2 { color: #2c5282; } .highlight { background: #ebf8ff; padding: 12px; border-left: 4px solid #3182ce; margin: 16px 0; } table { width: 100%; border-collapse: collapse; margin: 16px 0; } th { background: #2c5282; color: white; padding: 10px; text-align: left; } td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; } tr:nth-child(even) { background: #f7fafc; } .footer { color: #718096; font-size: 12px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; }</style></head>
<body>
<div class="container">
  <p>Hi team,</p>
  <p>I wanted to share the updated roadmap for Q1 2026. We've made some significant changes based on customer feedback and market analysis.</p>

  <div class="highlight">
    <strong>Key Decision:</strong> We're shifting our primary focus to mobile-first development starting this quarter. All new features will be designed for mobile before desktop.
  </div>

  <h2>Roadmap Overview</h2>
  <table>
    <thead>
      <tr><th>Initiative</th><th>Start Date</th><th>Owner</th><th>Status</th></tr>
    </thead>
    <tbody>
      <tr><td>Mobile app redesign</td><td>Feb 15</td><td>Alex Kumar</td><td>Planning</td></tr>
      <tr><td>API v3 migration</td><td>Feb 1</td><td>Jordan Lee</td><td>In Progress</td></tr>
      <tr><td>Analytics dashboard</td><td>Mar 1</td><td>Priya Patel</td><td>Design</td></tr>
      <tr><td>Performance audit</td><td>Mar 15</td><td>You</td><td>Not Started</td></tr>
    </tbody>
  </table>

  <h2>Timeline</h2>
  <img src="https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&h=300&fit=crop" alt="Q1 2026 Roadmap Timeline" title="Interactive timeline available at roadmap.techcorp.io">

  <h2>Budget Allocation</h2>
  <table>
    <thead>
      <tr><th>Department</th><th>Q4 2025</th><th>Q1 2026</th><th>Change</th></tr>
    </thead>
    <tbody>
      <tr><td>Engineering</td><td>$420K</td><td>$480K</td><td style="color: green;">+14%</td></tr>
      <tr><td>Design</td><td>$180K</td><td>$210K</td><td style="color: green;">+17%</td></tr>
      <tr><td>QA</td><td>$120K</td><td>$135K</td><td style="color: green;">+12%</td></tr>
      <tr><td>DevOps</td><td>$95K</td><td>$95K</td><td>0%</td></tr>
    </tbody>
  </table>

  <p>Please review the attached document and let me know if you have any questions or concerns. We'll discuss this in detail during our Thursday sync.</p>

  <p>Looking forward to your feedback!</p>

  <p>Best,<br>Sarah</p>

  <div class="footer">
    <p>TechCorp Inc. | 123 Innovation Blvd, San Francisco, CA 94105</p>
  </div>
</div>
</body>
</html>`,
    snippet: "I wanted to share the updated roadmap for Q1 2026. We've made some significant changes...",
    labelIds: ["INBOX", "IMPORTANT", "UNREAD", "STARRED"],
    attachments: [
      { attachmentId: "att-001", partId: "2", filename: "Q1-2026-Roadmap.pdf", mimeType: "application/pdf", size: 2457600 },
    ],
  },
  {
    id: "email-013",
    threadId: "thread-013",
    subject: "Invitation: Q1 Planning Kickoff @ Thu Feb 20, 2026 2:00pm - 3:30pm (PST)",
    from: { email: "calendar-notification@google.com", name: "Google Calendar" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<calendar-invite-q1-kickoff@google.com>",
    date: DateTime.now().minus({ hours: 1 }).toISO()!,
    body: "Q1 Planning Kickoff\nWhen: Thursday, February 20, 2026 2:00pm – 3:30pm (Pacific Time)\nWhere: Conference Room A / Google Meet\nOrganizer: Sarah Chen",
    bodyHtml: `<div style="font-family: Google Sans, Roboto, Arial, sans-serif; max-width: 600px; color: #3c4043;">
  <div style="background: #1a73e8; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-weight: 400; font-size: 20px;">Q1 Planning Kickoff</h2>
    <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">Thursday, February 20 · 2:00 – 3:30pm</p>
  </div>
  <div style="border: 1px solid #dadce0; border-top: none; border-radius: 0 0 8px 8px; padding: 20px 24px;">
    <table style="width: 100%; font-size: 14px;">
      <tr>
        <td style="padding: 8px 0; color: #5f6368; width: 80px; vertical-align: top;">When</td>
        <td style="padding: 8px 0;">Thursday, February 20, 2026<br>2:00pm – 3:30pm (Pacific Time)</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #5f6368; vertical-align: top;">Where</td>
        <td style="padding: 8px 0;">Conference Room A<br><a href="https://meet.google.com/abc-defg-hij" style="color: #1a73e8;">Join with Google Meet</a></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #5f6368; vertical-align: top;">Who</td>
        <td style="padding: 8px 0;">
          <strong>Sarah Chen</strong> (organizer)<br>
          You, Alex Kumar, Jordan Lee, Priya Patel
        </td>
      </tr>
    </table>
    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #dadce0; font-size: 14px;">
      <p style="margin: 0;">Let's kick off Q1 planning! We'll review the roadmap, assign owners, and align on milestones. Please come prepared with your team's capacity estimates.</p>
    </div>
  </div>
</div>`,
    snippet: "Q1 Planning Kickoff — Thursday, February 20, 2:00pm – 3:30pm. Join with Google Meet.",
    labelIds: ["INBOX", "UNREAD"],
    attachments: [],
    calendarEvent: {
      uid: "q1-kickoff-2026@techcorp.io",
      summary: "Q1 Planning Kickoff",
      description: "Let's kick off Q1 planning! We'll review the roadmap, assign owners, and align on milestones. Please come prepared with your team's capacity estimates.",
      location: "Conference Room A",
      start: "2026-02-20T14:00:00",
      end: "2026-02-20T15:30:00",
      organizer: { email: "sarah.chen@techcorp.io", name: "Sarah Chen" },
      attendees: [
        { email: "sarah.chen@techcorp.io", name: "Sarah Chen", status: "ACCEPTED", role: "CHAIR" },
        { email: "me@example.com", name: "You", status: "NEEDS-ACTION", role: "REQ-PARTICIPANT" },
        { email: "alex.kumar@techcorp.io", name: "Alex Kumar", status: "ACCEPTED", role: "REQ-PARTICIPANT" },
        { email: "jordan.lee@techcorp.io", name: "Jordan Lee", status: "TENTATIVE", role: "REQ-PARTICIPANT" },
        { email: "priya.patel@techcorp.io", name: "Priya Patel", status: "NEEDS-ACTION", role: "REQ-PARTICIPANT" },
      ],
      method: "REQUEST",
      status: "CONFIRMED",
      sequence: 0,
      conferenceUrl: "https://meet.google.com/abc-defg-hij",
      myStatus: "NEEDS-ACTION",
    },
  },
  {
    id: "email-014",
    threadId: "thread-014",
    subject: "Updated invitation: Design Review → Moved to Friday Feb 21",
    from: { email: "calendar-notification@google.com", name: "Google Calendar" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<calendar-update-design-review@google.com>",
    date: DateTime.now().minus({ hours: 3 }).toISO()!,
    body: "Design Review (updated)\nWhen: Friday, February 21, 2026 10:00am – 11:00am (Pacific Time)\nWhere: https://meet.google.com/xyz-uvwx-rst\nOrganizer: Jamie Wong\n\nThis event has been updated: time changed from Thursday to Friday.",
    snippet: "Design Review moved to Friday Feb 21, 10:00am. Updated by Jamie Wong.",
    labelIds: ["INBOX"],
    attachments: [],
    calendarEvent: {
      uid: "design-review-weekly@company.com",
      summary: "Design Review",
      description: "Weekly design review — bring your latest mockups and prototypes.\n\nNote: Moved from Thursday to Friday this week due to the all-hands.",
      start: "2026-02-21T10:00:00",
      end: "2026-02-21T11:00:00",
      organizer: { email: "jamie.wong@company.com", name: "Jamie Wong" },
      attendees: [
        { email: "jamie.wong@company.com", name: "Jamie Wong", status: "ACCEPTED", role: "CHAIR" },
        { email: "me@example.com", name: "You", status: "ACCEPTED", role: "REQ-PARTICIPANT" },
        { email: "design-team@company.com", name: "Design Team", status: "NEEDS-ACTION", role: "REQ-PARTICIPANT" },
      ],
      method: "REQUEST",
      status: "CONFIRMED",
      sequence: 2,
      conferenceUrl: "https://meet.google.com/xyz-uvwx-rst",
      myStatus: "ACCEPTED",
    },
  },
  {
    id: "email-015",
    threadId: "thread-015",
    subject: "Cancelled: Friday Social (Feb 14)",
    from: { email: "calendar-notification@google.com", name: "Google Calendar" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<calendar-cancel-social@google.com>",
    date: DateTime.now().minus({ days: 1, hours: 2 }).toISO()!,
    body: "This event has been cancelled.\n\nFriday Social\nWhen: Friday, February 14, 2026 5:00pm – 6:30pm\nOrganizer: Marcus Johnson\n\nSorry folks, need to reschedule — will send a new invite next week!",
    snippet: "Cancelled: Friday Social (Feb 14) — Marcus Johnson cancelled this event.",
    labelIds: ["INBOX"],
    attachments: [],
    calendarEvent: {
      uid: "friday-social-feb14@email.com",
      summary: "Friday Social",
      description: "Sorry folks, need to reschedule — will send a new invite next week!",
      start: "2026-02-14T17:00:00",
      end: "2026-02-14T18:30:00",
      organizer: { email: "marcus.j@email.com", name: "Marcus Johnson" },
      attendees: [
        { email: "marcus.j@email.com", name: "Marcus Johnson", status: "DECLINED", role: "CHAIR" },
        { email: "me@example.com", name: "You", status: "ACCEPTED", role: "REQ-PARTICIPANT" },
      ],
      method: "CANCEL",
      status: "CANCELLED",
      sequence: 1,
      myStatus: "ACCEPTED",
    },
  },
  {
    id: "email-002",
    threadId: "thread-002",
    subject: "Re: Weekend hiking trip?",
    from: { email: "marcus.j@email.com", name: "Marcus Johnson" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<hiking-reply-001@email.com>",
    inReplyTo: "<hiking-001@example.com>",
    references: ["<hiking-001@example.com>"],
    date: DateTime.now().minus({ hours: 5 }).toISO()!,
    body: `Hey!

Saturday works great for me. I was thinking we could try the Eagle Peak trail - it's about 8 miles round trip with some decent elevation gain.

Should I bring my camping stove? We could make coffee at the summit.

Let me know what time works best. I can pick you up if needed.

Cheers,
Marcus`,
    snippet: "Saturday works great for me. I was thinking we could try the Eagle Peak trail...",
    labelIds: ["INBOX", "UNREAD"],
    attachments: [],
  },
  {
    id: "email-003",
    threadId: "thread-003",
    subject: "Invoice #INV-2026-0234 - Payment Received",
    from: { email: "billing@cloudservices.net", name: "Cloud Services Billing" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<inv-2026-0234@cloudservices.net>",
    date: DateTime.now().minus({ hours: 8 }).toISO()!,
    body: "Thank you for your payment of $89.99 for Invoice #INV-2026-0234.",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><style>body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a202c; background: #f7fafc; } .wrapper { max-width: 560px; margin: 0 auto; background: white; padding: 32px; } .logo { text-align: center; margin-bottom: 24px; } .amount { font-size: 36px; font-weight: bold; color: #2f855a; text-align: center; margin: 24px 0; } .details { background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 16px; margin: 16px 0; } .detail-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e2e8f0; } .detail-row:last-child { border-bottom: none; } .label { color: #718096; } .value { font-weight: 600; } .btn { display: inline-block; background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; } .footer { text-align: center; color: #a0aec0; font-size: 11px; margin-top: 32px; }</style></head>
<body>
<div class="wrapper">
  <div class="logo">
    <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=180&h=60&fit=crop" alt="Cloud Services Logo" width="180">
  </div>

  <h1 style="text-align: center; color: #2d3748;">Payment Received</h1>
  <p style="text-align: center; color: #718096;">Invoice #INV-2026-0234</p>

  <div class="amount">$89.99</div>

  <div class="details">
    <div class="detail-row">
      <span class="label">Amount</span>
      <span class="value">$89.99</span>
    </div>
    <div class="detail-row">
      <span class="label">Date</span>
      <span class="value">${DateTime.now().minus({ hours: 8 }).toFormat("MMMM d, yyyy")}</span>
    </div>
    <div class="detail-row">
      <span class="label">Payment Method</span>
      <span class="value">Credit Card (****4532)</span>
    </div>
    <div class="detail-row">
      <span class="label">Status</span>
      <span class="value" style="color: #2f855a;">Paid</span>
    </div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin: 24px 0;">
    <thead>
      <tr><th style="text-align: left; padding: 8px; background: #edf2f7; border-bottom: 2px solid #cbd5e0;">Service</th><th style="text-align: right; padding: 8px; background: #edf2f7; border-bottom: 2px solid #cbd5e0;">Amount</th></tr>
    </thead>
    <tbody>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Pro Plan (Monthly)</td><td style="text-align: right; padding: 8px; border-bottom: 1px solid #e2e8f0;">$69.99</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">Extra Storage (50GB)</td><td style="text-align: right; padding: 8px; border-bottom: 1px solid #e2e8f0;">$15.00</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">API Add-on</td><td style="text-align: right; padding: 8px; border-bottom: 1px solid #e2e8f0;">$5.00</td></tr>
      <tr><td style="padding: 8px; font-weight: bold;">Total</td><td style="text-align: right; padding: 8px; font-weight: bold;">$89.99</td></tr>
    </tbody>
  </table>

  <p style="text-align: center;">
    <a href="https://dashboard.cloudservices.net/invoices/INV-2026-0234" class="btn">View Invoice</a>
  </p>

  <div class="footer">
    <p>Cloud Services Inc. | billing@cloudservices.net</p>
    <p>If you have questions about this invoice, reply to this email or visit our <a href="https://help.cloudservices.net">help center</a>.</p>
  </div>
</div>
</body>
</html>`,
    snippet: "Thank you for your payment of $89.99 for Invoice #INV-2026-0234...",
    labelIds: ["INBOX"],
    attachments: [],
  },
  {
    id: "email-004",
    threadId: "thread-004",
    subject: "GitHub: [project/repo] New pull request #142",
    from: { email: "notifications@github.com", name: "GitHub" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<github-pr-142@github.com>",
    date: DateTime.now().minus({ days: 1 }).toISO()!,
    body: "@devuser opened a new pull request",
    bodyHtml: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; color: #24292f;">
  <div style="border-bottom: 1px solid #d0d7de; padding-bottom: 16px; margin-bottom: 16px;">
    <img src="https://picsum.photos/id/0/32/32" alt="GitHub Logo" width="32" style="vertical-align: middle;">
    <span style="font-size: 14px; color: #57606a; vertical-align: middle; margin-left: 8px;">project/repo</span>
  </div>

  <p><a href="https://github.com/devuser" style="color: #0969da; font-weight: 600;">@devuser</a> opened a new pull request:</p>

  <h2 style="font-size: 20px; border-bottom: 1px solid #d0d7de; padding-bottom: 8px;">
    <a href="https://github.com/project/repo/pull/142" style="color: #0969da; text-decoration: none;">#142</a>
    feat: Add dark mode support
  </h2>

  <p>This PR adds comprehensive dark mode support across the application.</p>

  <h3>Changes</h3>
  <ul>
    <li>Add theme context and provider</li>
    <li>Update all components to use CSS variables</li>
    <li>Add theme toggle in settings</li>
    <li>Fix contrast issues in existing dark surfaces</li>
  </ul>

  <h3>Screenshots</h3>
  <table style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; text-align: center; width: 50%;"><strong>Before (Light)</strong></td>
      <td style="padding: 8px; text-align: center; width: 50%;"><strong>After (Dark)</strong></td>
    </tr>
    <tr>
      <td style="padding: 8px;"><img src="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=250&fit=crop" alt="Light mode screenshot"></td>
      <td style="padding: 8px;"><img src="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=250&fit=crop" alt="Dark mode screenshot"></td>
    </tr>
  </table>

  <h3>Test Results</h3>
  <pre style="background: #f6f8fa; padding: 12px; border-radius: 6px; font-size: 13px; overflow-x: auto;"><code>✓ ThemeProvider renders correctly (12ms)
✓ Dark mode toggle works (8ms)
✓ CSS variables are applied (15ms)
✓ Contrast ratios pass WCAG AA (23ms)

Tests: 4 passed, 4 total
Time:  1.234s</code></pre>

  <p style="margin-top: 16px;">
    <a href="https://github.com/project/repo/pull/142" style="background: #2da44e; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 600;">Review Pull Request</a>
  </p>

  <hr style="border: none; border-top: 1px solid #d0d7de; margin: 24px 0;">
  <p style="color: #57606a; font-size: 12px;">You are receiving this because you were assigned. <a href="https://github.com/settings/notifications" style="color: #0969da;">Manage notifications</a></p>
</div>`,
    snippet: "@devuser opened a new pull request: #142 feat: Add dark mode support...",
    labelIds: ["INBOX"],
    attachments: [],
  },
  {
    id: "email-005",
    threadId: "thread-005",
    subject: "Your flight to Berlin is confirmed",
    from: { email: "bookings@airline.com", name: "Sky Airlines" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<booking-sky7x9k2m@airline.com>",
    date: DateTime.now().minus({ days: 1, hours: 4 }).toISO()!,
    body: "Your flight booking has been confirmed!",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><style>body { font-family: Arial, sans-serif; color: #2d3748; background: #f7fafc; margin: 0; padding: 0; } .header { background: linear-gradient(135deg, #1a365d, #2b6cb0); color: white; padding: 32px; text-align: center; } .header h1 { margin: 0; font-size: 24px; } .content { max-width: 560px; margin: 0 auto; padding: 24px; background: white; } .flight-card { background: #ebf8ff; border: 1px solid #90cdf4; border-radius: 8px; padding: 20px; margin: 16px 0; } .route { display: flex; align-items: center; justify-content: center; gap: 16px; margin: 16px 0; } .city { text-align: center; } .city-code { font-size: 28px; font-weight: bold; color: #2b6cb0; } .city-name { font-size: 12px; color: #718096; } .divider { font-size: 20px; color: #a0aec0; }</style></head>
<body>
<div class="header">
  <img src="https://images.unsplash.com/photo-1436491865332-7a61a109db05?w=140&h=50&fit=crop" alt="Sky Airlines Logo" width="140">
  <h1>Booking Confirmed!</h1>
  <p style="margin: 8px 0 0; opacity: 0.8;">Reference: SKY7X9K2M</p>
</div>
<div class="content">
  <div class="flight-card">
    <div style="text-align: center; color: #718096; font-size: 14px; margin-bottom: 8px;">March 15, 2026</div>
    <div class="route">
      <div class="city">
        <div class="city-code">SFO</div>
        <div class="city-name">San Francisco</div>
        <div style="font-size: 14px; color: #4a5568;">18:45</div>
      </div>
      <div class="divider">✈ ─────</div>
      <div class="city">
        <div class="city-code">BER</div>
        <div class="city-name">Berlin</div>
        <div style="font-size: 14px; color: #4a5568;">14:30+1</div>
      </div>
    </div>
    <div style="text-align: center; font-size: 13px; color: #718096;">Flight SA 1872 · 11h 45m</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 8px 0; color: #718096; border-bottom: 1px solid #e2e8f0;">Passenger</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">You</td></tr>
    <tr><td style="padding: 8px 0; color: #718096; border-bottom: 1px solid #e2e8f0;">Seat</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">24A (Window)</td></tr>
    <tr><td style="padding: 8px 0; color: #718096; border-bottom: 1px solid #e2e8f0;">Class</td><td style="padding: 8px 0; text-align: right; border-bottom: 1px solid #e2e8f0; font-weight: 600;">Economy Plus</td></tr>
    <tr><td style="padding: 8px 0; color: #718096;">Baggage</td><td style="padding: 8px 0; text-align: right; font-weight: 600;">1x Carry-on, 1x Checked (23kg)</td></tr>
  </table>

  <div style="background: #fffbeb; border: 1px solid #fbd38d; border-radius: 6px; padding: 12px; margin: 16px 0;">
    <strong style="color: #975a16;">⚠ Important:</strong>
    <span style="color: #744210;">Please arrive at the airport at least 3 hours before departure for international flights.</span>
  </div>

  <img src="https://images.unsplash.com/photo-1560969184-10fe8719e047?w=600&h=300&fit=crop" alt="Berlin skyline at sunset" title="Your destination: Berlin, Germany">

  <p>Have a great trip! ✈</p>

  <div style="text-align: center; color: #a0aec0; font-size: 11px; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
    <p>Sky Airlines | bookings@airline.com | +1-800-SKY-FLY1</p>
    <p><a href="https://skyairlines.com/manage/SKY7X9K2M">Manage your booking</a> | <a href="https://skyairlines.com/checkin">Online check-in</a></p>
  </div>
</div>
</body>
</html>`,
    snippet: "Your flight booking has been confirmed! Booking Reference: SKY7X9K2M...",
    labelIds: ["INBOX", "IMPORTANT", "STARRED"],
    attachments: [
      { attachmentId: "att-002", partId: "2", filename: "boarding-pass.pdf", mimeType: "application/pdf", size: 156789 },
      { attachmentId: "att-003", partId: "3", filename: "itinerary.pdf", mimeType: "application/pdf", size: 234567 },
    ],
  },
  {
    id: "email-006",
    threadId: "thread-006",
    subject: "Team lunch this Friday?",
    from: { email: "jamie.wong@company.com", name: "Jamie Wong" },
    to: [{ email: "me@example.com", name: "You" }],
    cc: [
      { email: "dev-team@company.com", name: "Dev Team" },
    ],
    messageId: "<lunch-friday-001@company.com>",
    date: DateTime.now().minus({ days: 2 }).toISO()!,
    body: `Hey everyone!

It's been a while since we all got together outside of work. How about lunch this Friday?

I was thinking that new Korean BBQ place downtown - heard great things about it.

Let me know if you're in!

Jamie`,
    snippet: "It's been a while since we all got together outside of work. How about lunch...",
    labelIds: ["INBOX"],
    attachments: [],
  },
  {
    id: "email-007",
    threadId: "thread-007",
    subject: "Security Alert: New sign-in from Chrome on macOS",
    from: { email: "security@accounts.google.com", name: "Google" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<security-alert-001@accounts.google.com>",
    date: DateTime.now().minus({ days: 2, hours: 6 }).toISO()!,
    body: "New sign-in to your Google Account",
    bodyHtml: `<div style="font-family: 'Google Sans', Roboto, Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #202124;">
  <div style="text-align: center; padding: 24px 0;">
    <img src="https://picsum.photos/id/1/74/24" alt="Google Logo" width="74">
  </div>

  <div style="background: white; border: 1px solid #dadce0; border-radius: 8px; padding: 24px;">
    <div style="text-align: center; margin-bottom: 24px;">
      <img src="https://picsum.photos/id/9/48/48" alt="Security shield icon" width="48">
    </div>

    <h2 style="text-align: center; font-size: 18px; font-weight: 400; color: #202124;">New sign-in to your Google Account</h2>

    <p style="color: #5f6368; line-height: 1.6;">We noticed a new sign-in to your Google Account on a macOS device. If this was you, you don't need to do anything. If not, we'll help you secure your account.</p>

    <div style="background: #f1f3f4; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <table style="width: 100%;">
        <tr><td style="padding: 4px 0; color: #5f6368; width: 100px;">Device</td><td style="padding: 4px 0; font-weight: 500;">MacBook Pro</td></tr>
        <tr><td style="padding: 4px 0; color: #5f6368;">Location</td><td style="padding: 4px 0; font-weight: 500;">San Francisco, CA, USA</td></tr>
        <tr><td style="padding: 4px 0; color: #5f6368;">Browser</td><td style="padding: 4px 0; font-weight: 500;">Chrome</td></tr>
        <tr><td style="padding: 4px 0; color: #5f6368;">Time</td><td style="padding: 4px 0; font-weight: 500;">${DateTime.now().minus({ days: 2, hours: 6 }).toFormat("MMM d, yyyy 'at' h:mm a")}</td></tr>
      </table>
    </div>

    <p style="text-align: center; margin: 24px 0;">
      <a href="https://myaccount.google.com/notifications" style="background: #1a73e8; color: white; padding: 10px 24px; border-radius: 4px; text-decoration: none; font-weight: 500;">Check activity</a>
    </p>

    <p style="color: #5f6368; font-size: 13px;">If you don't recognize this activity, please <a href="https://myaccount.google.com/security" style="color: #1a73e8;">secure your account</a> immediately.</p>
  </div>

  <p style="text-align: center; color: #5f6368; font-size: 11px; margin-top: 16px;">
    You received this email to let you know about important changes to your Google Account and services.<br>
    © 2026 Google LLC, 1600 Amphitheatre Parkway, Mountain View, CA 94043
  </p>
</div>`,
    snippet: "New sign-in to your Google Account. We noticed a new sign-in on a macOS device...",
    labelIds: ["INBOX"],
    attachments: [],
  },
  {
    id: "email-008",
    threadId: "thread-008",
    subject: "Re: Re: Project deadline extension request",
    from: { email: "director@company.com", name: "Emily Director" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<deadline-ext-003@company.com>",
    inReplyTo: "<deadline-ext-002@example.com>",
    references: ["<deadline-ext-001@example.com>", "<deadline-ext-002@example.com>"],
    date: DateTime.now().minus({ days: 3 }).toISO()!,
    body: `Hi,

I've reviewed your request for the deadline extension on the authentication module.

Given the scope creep we've experienced and the additional security requirements from the compliance team, I approve a one-week extension. The new deadline will be February 21st.

Please update the project timeline and notify stakeholders accordingly.

Best,
Emily`,
    snippet: "I've reviewed your request for the deadline extension. I approve a one-week extension...",
    labelIds: ["INBOX", "IMPORTANT"],
    attachments: [],
  },
  {
    id: "email-009",
    threadId: "thread-009",
    subject: "Newsletter: Top 10 Vim Tips You Didn't Know",
    from: { email: "newsletter@devweekly.io", name: "Dev Weekly" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<newsletter-234@devweekly.io>",
    date: DateTime.now().minus({ days: 4 }).toISO()!,
    body: "DEV WEEKLY #234 - TOP 10 VIM TIPS YOU DIDN'T KNOW",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><style>body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a202c; background: #f7fafc; margin: 0; } .header { background: #1a202c; color: white; padding: 32px; text-align: center; } .header h1 { margin: 0 0 8px; font-size: 28px; } .header p { color: #a0aec0; margin: 0; } .content { max-width: 600px; margin: 0 auto; padding: 24px; background: white; } .tip { border-left: 3px solid #805ad5; padding: 8px 16px; margin: 12px 0; background: #faf5ff; } .tip code { background: #e9d8fd; padding: 2px 6px; border-radius: 3px; font-family: 'Fira Code', monospace; font-size: 14px; } .section { margin-top: 32px; padding-top: 16px; border-top: 2px solid #e2e8f0; } .article { display: flex; gap: 12px; margin: 12px 0; padding: 12px; background: #f7fafc; border-radius: 6px; }</style></head>
<body>
<div class="header">
  <img src="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=200&h=60&fit=crop" alt="Dev Weekly Logo" width="200">
  <h1>DEV WEEKLY #234</h1>
  <p>Your weekly dose of developer goodness</p>
</div>
<div class="content">
  <h2 style="color: #805ad5;">🔥 Top 10 Vim Tips You Didn't Know</h2>
  <p>Whether you're a seasoned Vim user or just starting out, these tips will boost your productivity:</p>

  <div class="tip"><strong>1.</strong> <code>gq{motion}</code> — Reformat text to fit within textwidth</div>
  <div class="tip"><strong>2.</strong> <code>:earlier 15m</code> — Travel back in time 15 minutes</div>
  <div class="tip"><strong>3.</strong> <code>Ctrl+a / Ctrl+x</code> — Increment/decrement numbers under cursor</div>
  <div class="tip"><strong>4.</strong> <code>gi</code> — Jump to last insert position and enter insert mode</div>
  <div class="tip"><strong>5.</strong> <code>\`\`</code> — Jump back to the exact previous cursor position</div>
  <div class="tip"><strong>6.</strong> <code>:g/pattern/d</code> — Delete all lines matching a pattern</div>
  <div class="tip"><strong>7.</strong> <code>:sort u</code> — Sort lines and remove duplicates</div>
  <div class="tip"><strong>8.</strong> <code>zz/zt/zb</code> — Center/top/bottom the current line on screen</div>
  <div class="tip"><strong>9.</strong> <code>*</code> and <code>#</code> — Search forward/backward for word under cursor</div>
  <div class="tip"><strong>10.</strong> <code>:!command</code> — Run shell commands without leaving Vim</div>

  <p><a href="https://devweekly.io/vim-tips" style="color: #805ad5; font-weight: 600;">Read the full article →</a></p>

  <div class="section">
    <h2>📰 Also This Week</h2>

    <div class="article">
      <img src="https://images.unsplash.com/photo-1515879218367-8466d910auj7?w=80&h=80&fit=crop" alt="Rust 2.0 article thumbnail" width="80" style="border-radius: 4px;">
      <div>
        <h3 style="margin: 0 0 4px; font-size: 16px;"><a href="https://devweekly.io/rust-2" style="color: #1a202c; text-decoration: none;">Rust 2.0 Release Candidate</a></h3>
        <p style="margin: 0; color: #718096; font-size: 14px;">The long-awaited Rust 2.0 RC brings async traits, better error messages, and more.</p>
      </div>
    </div>

    <div class="article">
      <img src="https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=80&h=80&fit=crop" alt="TypeScript 6.0 article thumbnail" width="80" style="border-radius: 4px;">
      <div>
        <h3 style="margin: 0 0 4px; font-size: 16px;"><a href="https://devweekly.io/ts-6" style="color: #1a202c; text-decoration: none;">TypeScript 6.0 Features</a></h3>
        <p style="margin: 0; color: #718096; font-size: 14px;">Pattern matching, pipe operator, and improved inference in the latest TypeScript.</p>
      </div>
    </div>

    <div class="article">
      <img src="https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=80&h=80&fit=crop" alt="Glyph TUI article thumbnail" width="80" style="border-radius: 4px;">
      <div>
        <h3 style="margin: 0 0 4px; font-size: 16px;"><a href="https://devweekly.io/glyph" style="color: #1a202c; text-decoration: none;">Building Terminal UIs with Glyph</a></h3>
        <p style="margin: 0; color: #718096; font-size: 14px;">A new React-based framework for building beautiful terminal applications.</p>
      </div>
    </div>
  </div>

  <div style="text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #a0aec0; font-size: 12px;">
    <p>Dev Weekly | newsletter@devweekly.io</p>
    <p><a href="https://devweekly.io/unsubscribe" style="color: #a0aec0;">Unsubscribe</a> | <a href="https://devweekly.io/preferences" style="color: #a0aec0;">Preferences</a></p>
  </div>
</div>
</body>
</html>`,
    snippet: "TOP 10 VIM TIPS YOU DIDN'T KNOW. 1. gq{motion} - Reformat text...",
    labelIds: ["INBOX"],
    attachments: [],
  },
  {
    id: "email-010",
    threadId: "thread-010",
    subject: "Your order has shipped!",
    from: { email: "orders@shop.com", name: "Tech Shop" },
    to: [{ email: "me@example.com", name: "You" }],
    messageId: "<order-78342@shop.com>",
    date: DateTime.now().minus({ days: 5 }).toISO()!,
    body: "Great news! Your order is on its way!",
    bodyHtml: `<!DOCTYPE html>
<html>
<head><style>body { font-family: Arial, sans-serif; color: #333; background: #f5f5f5; margin: 0; } .container { max-width: 560px; margin: 0 auto; background: white; } .banner { background: #ff6b00; color: white; padding: 24px; text-align: center; } .banner h1 { margin: 0; font-size: 22px; } .body { padding: 24px; } .order-number { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; } .product { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid #eee; } .progress { margin: 24px 0; } .progress-bar { display: flex; justify-content: space-between; position: relative; } .step { text-align: center; flex: 1; font-size: 12px; color: #999; } .step.active { color: #ff6b00; font-weight: bold; }</style></head>
<body>
<div class="container">
  <div class="banner">
    <h1>📦 Your Order Has Shipped!</h1>
  </div>
  <div class="body">
    <p class="order-number">Order #TS-2026-78342</p>

    <div class="progress">
      <table style="width: 100%; text-align: center; font-size: 13px;">
        <tr>
          <td style="color: #ff6b00; font-weight: bold;">✓ Ordered</td>
          <td style="color: #ff6b00; font-weight: bold;">✓ Packed</td>
          <td style="color: #ff6b00; font-weight: bold;">✓ Shipped</td>
          <td style="color: #999;">○ Delivered</td>
        </tr>
      </table>
    </div>

    <h3>Items in your order:</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 0;">
          <img src="https://images.unsplash.com/photo-1595225476474-87563907a212?w=64&h=64&fit=crop" alt="Mechanical Keyboard product photo" width="64" style="border-radius: 4px;">
        </td>
        <td style="padding: 12px 8px;">
          <strong>Mechanical Keyboard</strong><br>
          <span style="color: #666; font-size: 13px;">Cherry MX Brown · Full size</span>
        </td>
        <td style="padding: 12px 0; text-align: right; font-weight: bold;">$149.99</td>
      </tr>
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 0;">
          <img src="https://images.unsplash.com/photo-1625842268584-8f3296236761?w=64&h=64&fit=crop" alt="USB-C Hub product photo" width="64" style="border-radius: 4px;">
        </td>
        <td style="padding: 12px 8px;">
          <strong>USB-C Hub</strong><br>
          <span style="color: #666; font-size: 13px;">7-port · Aluminum</span>
        </td>
        <td style="padding: 12px 0; text-align: right; font-weight: bold;">$49.99</td>
      </tr>
    </table>

    <table style="width: 100%; margin-top: 16px; font-size: 14px;">
      <tr><td style="padding: 4px 0; color: #666;">Subtotal</td><td style="text-align: right;">$199.98</td></tr>
      <tr><td style="padding: 4px 0; color: #666;">Shipping</td><td style="text-align: right; color: #2f855a;">FREE</td></tr>
      <tr><td style="padding: 4px 0; color: #666;">Tax</td><td style="text-align: right;">$17.50</td></tr>
      <tr style="font-weight: bold; font-size: 16px;"><td style="padding: 8px 0; border-top: 2px solid #333;">Total</td><td style="text-align: right; padding: 8px 0; border-top: 2px solid #333;">$217.48</td></tr>
    </table>

    <div style="background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 6px; padding: 12px; margin: 20px 0; text-align: center;">
      <strong>Estimated Delivery:</strong> February 12-14, 2026<br>
      <span style="color: #666; font-size: 13px;">Tracking: 1Z999AA10123456784</span>
    </div>

    <p style="text-align: center;">
      <a href="https://track.shop.com/1Z999AA10123456784" style="background: #ff6b00; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Track Your Package</a>
    </p>

    <div style="text-align: center; color: #999; font-size: 11px; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px;">
      <p>Tech Shop | orders@shop.com | 1-800-TECH-SHOP</p>
    </div>
  </div>
</div>
</body>
</html>`,
    snippet: "Great news! Your order is on its way! Mechanical Keyboard, USB-C Hub...",
    labelIds: ["INBOX"],
    attachments: [],
  },
  {
    id: "email-011",
    threadId: "thread-002",
    subject: "Weekend hiking trip?",
    from: { email: "me@example.com", name: "You" },
    to: [{ email: "marcus.j@email.com", name: "Marcus Johnson" }],
    messageId: "<hiking-001@example.com>",
    date: DateTime.now().minus({ hours: 12 }).toISO()!,
    body: `Hey Marcus!

The weather looks great this weekend. Want to go hiking?

I'm free Saturday or Sunday. Let me know what works for you!`,
    snippet: "The weather looks great this weekend. Want to go hiking?",
    labelIds: ["SENT"],
    attachments: [],
  },
  {
    id: "email-012",
    threadId: "thread-012",
    subject: "Draft: Quarterly report notes",
    from: { email: "me@example.com", name: "You" },
    to: [],
    messageId: "<draft-quarterly-001@example.com>",
    date: DateTime.now().minus({ hours: 3 }).toISO()!,
    body: `Q1 2026 Notes:

- Revenue up 15% YoY
- New customer acquisition: 2,340
- Churn rate: 3.2% (down from 4.1%)

TODO:
- Add charts
- Get final numbers from finance
- Review with team lead`,
    snippet: "Q1 2026 Notes: Revenue up 15% YoY, New customer acquisition: 2,340...",
    labelIds: ["DRAFT"],
    attachments: [],
  },
];

// Get emails by label
export function getEmailsByLabel(emails: Email[], label: string): Email[] {
  return emails.filter(e => e.labelIds.includes(label));
}

// Get unread count for label
export function getUnreadCount(emails: Email[], label: string): number {
  return getEmailsByLabel(emails, label).filter(e => e.labelIds.includes("UNREAD")).length;
}
