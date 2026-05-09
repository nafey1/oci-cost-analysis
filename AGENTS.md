# AGENTS.md

## Purpose

This file defines how agents must operate in this repository.

Primary goals:

- keep `README.md` accurate, complete, and structurally stable
- avoid accidental loss of project setup, OCI, Docker, and API documentation
- keep UI changes tied to the actual OCI Cost Analysis workflow
- communicate in a direct, technical style

## Non-Negotiable README Rules

1. `README.md` structure must stay intentional.
- Preserve the existing top-level `##` section set and order unless the user explicitly asks to change README structure.
- If updating README from another repository style, adapt the structure to this app instead of copying unrelated sections.
- Keep the final update-history section at the end of the file and keep it as bullet points only.

2. Never silently lose README content.
- If edits would remove meaningful existing content, stop and ask permission first.
- If the user has edited README text, preserve that text whenever possible.
- If simplification is requested, summarize exactly what will be removed and get explicit approval before deleting non-trivial content.

3. Preserve OCI setup and safety guidance.
- Keep the `DEFAULT` OCI profile as the documented default.
- Keep Usage API region guidance clear: default to the tenancy home region because Cost Analysis usage queries are served from the home region.
- Keep start/end date semantics clear: start is inclusive and end is exclusive.
- Keep Docker instructions using host-mounted OCI config/keys; never suggest baking secrets into the image.

## Required README Validation Before Finalizing

For any README change, run and verify:

1. Section review:
- Compare top-level `##` headings before and after the README change.
- Confirm the ending update-history section remains present and bullet-only.

2. Loss check:
- Review `git diff -- README.md`.
- Confirm whether any meaningful content was deleted.
- If deletion occurred, confirm user permission is recorded in the thread.

3. Report verification commands used.

Suggested commands:

```bash
git diff -- README.md
rg '^## ' README.md
tail -n 30 README.md
```

## Communication Style

Use direct, technical communication.

- No fluff, no hype, no vague language.
- State assumptions and constraints explicitly.
- Prefer concrete file and command references.
- If a requested chart or UI interaction would misrepresent cost data, say so and choose the more accurate design.

## Change Safety Rules

- Do not revert user changes unless explicitly requested.
- If unexpected local changes appear, work with them when they are relevant and ignore them when they are unrelated.
- Keep commits focused and reviewable.
- Prefer small documentation diffs unless the user asks for a broader README rewrite.
- Do not commit `.env`, OCI private keys, exported cost reports, or tenancy-specific sensitive data.

## Repo Notes

- The app is served by `src/server.js`.
- Browser UI code lives in `public/app.js`, `public/index.html`, and `public/styles.css`.
- OCI authentication is centralized in `src/ociAuth.js`.
- Usage API calls are centralized in `src/usageClient.js`.
- Usage normalization, grouping, CSV export, and Excel export live in `src/usageReport.js`.
- Configuration defaults and allowed Group By values live in `src/config.js`.
- The app is stateless except for a short in-memory report cache.
- Treat OCI cost exports and raw usage rows as sensitive financial data.
