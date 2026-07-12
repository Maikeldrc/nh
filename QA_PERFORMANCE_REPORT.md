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
- Three serial production smoke runs completed in about 11-14 seconds each for four browser checks.
- No load or concurrency testing has been run.
- Production smoke tests are intentionally configured with `workers: 1` to avoid unnecessary concurrent login/API load against production.
