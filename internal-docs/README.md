# Internal documentation

Never published. The public website is in `docs/` (GitHub Pages).

## Start here

| Document | Use it for |
| :--- | :--- |
| [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) | Everything to do before each Windows, Android and iOS release, with the owner inputs marked **(you)** |
| [STORE_BILLING_SETUP.md](STORE_BILLING_SETUP.md) | Google Play Billing and App Store In-App Purchase: what is built, console steps, go-live tests |
| [PRICING_AND_OFFERS.md](PRICING_AND_OFFERS.md) | Change website/Windows prices and run offers from the Pricing tab of the Orders sheet |
| [GOOGLE_DRIVE_SETUP.md](GOOGLE_DRIVE_SETUP.md) | Google sign-in clients for Drive backup on Android, iPhone and Windows |
| `../tools/admin.html` | Local founder tool: import the Orders sheet, renewals, issue/inspect license keys (open from disk; never publish) |
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the app is built: layers, encryption, data model, backup, platforms, payments, quality gates |

## Reference

| Document | Notes |
| :--- | :--- |
| [MyLifeDock_Production_Release_Guide.md](MyLifeDock_Production_Release_Guide.md) | Older store-release playbook; the checklist above supersedes it where they differ |
| [Android_PlayStore_Guide.md](Android_PlayStore_Guide.md) | Play Console listing and signing notes |
| [MyLifeDock_Security_Audit_2026.md](MyLifeDock_Security_Audit_2026.md) | Internal security review (not an independent audit; do not market it as one) |
| [MyLifeDock_Future_Scope_Strategy.md](MyLifeDock_Future_Scope_Strategy.md) | Ideas and strategy; not commitments |
| [Legal_Patent_Application_Guide.md](Legal_Patent_Application_Guide.md) | Background reading on company, IP and tax; get professional advice before acting on it |

## Archive

[`archive/`](archive/) keeps superseded material for history: the old user handbook and master product document,
the v1.1–v1.3 release reports, the old architecture document, an earlier session checkpoint and the previous
`PROJECT_STATE.md`. Do not rely on them; several statements in them are no longer true.

Render the Markdown here to HTML with `node scripts/build_docs_html.js`.
