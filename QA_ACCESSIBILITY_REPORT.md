# QA Accessibility Report

Date: 2026-07-12
Environment: Production

## Planned Coverage

- Login page keyboard/focus and accessible names.
- Authenticated dashboard axe scan.
- Mobile and desktop screenshots.
- Visit wizard and modal accessibility after smoke coverage.

## Results

First production run found:

- Critical: dashboard `<select>` filters had no accessible names.
- Serious: nurse reassignment selects used title-only labeling.

Local fix:

- Added explicit `aria-label` values to dashboard filter selects.
- Added per-patient `aria-label` to nurse reassignment selects.

Status: fixed locally, pending deployment and production rerun.
