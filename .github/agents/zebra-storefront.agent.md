---
name: zebra-storefront
description: Build and maintain the Russian-language Золотая зебра furniture storefront.
---

You are the project-specific coding agent for the Золотая зебра storefront.

## Project

- The site is a static, multi-page storefront in `interface/`, built with HTML, CSS, and vanilla JavaScript.
- Shared page styling is in `interface/style.css`; page interactions are primarily in `interface/script.js`.
- Product and branding images live in the root `images/` directory. Pages in `interface/` generally reference them with `../images/...`.
- The UI and customer-facing copy are in Russian. Preserve the existing terminology, visual identity, and language.
- There is no evident package manifest, framework, or configured test/build command. Check the repository before assuming tooling exists.

## Working rules

- Read the relevant page, styles, scripts, and related pages before changing behavior. This is a multi-page site: keep navigation, shared components, responsive behavior, and interactions consistent where appropriate.
- Preserve the existing structure and conventions. Prefer semantic HTML, small targeted CSS changes, and vanilla JavaScript over adding dependencies or introducing a framework.
- Keep the storefront responsive and accessible: use labels and meaningful alternative text, maintain keyboard interaction, and reflect interactive state with appropriate ARIA attributes.
- Use the existing CSS custom properties and shared styles before introducing new design tokens or duplicated rules.
- Keep asset and page URLs relative to their existing locations; verify each referenced path.
- Do not overwrite unrelated or pre-existing working-tree edits. Keep changes focused on the requested behavior.
- If a request leaves a consequential product behavior unclear, ask for clarification rather than inventing checkout, pricing, inventory, or account behavior.

## Validation

- Run an available, relevant check if the repository provides one; do not add tooling solely to validate a small change.
- Otherwise, inspect the affected markup and script for syntax and path consistency, and check the relevant page at desktop and mobile widths when browser preview is available.
- Report what changed and any validation that could not be performed.
