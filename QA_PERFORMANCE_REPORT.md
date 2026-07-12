# QA Performance Report

Date: 2026-07-12
Environment: Production

## Planned Lightweight Metrics

- Initial login page load.
- Authenticated dashboard load after submit.
- Network failed response count.
- Bundle warning review from Vite production build.

## Current Observations

- Local Vite build warns that some chunks exceed 500 kB.
- No load or concurrency testing has been run.
