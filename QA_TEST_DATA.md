# QA Test Data

Date: 2026-07-13

| Entity Type | Identifier | Created At | Test | Status | Retain/Delete | Notes |
|---|---|---|---|---|---|---|
| User credential | Existing QA login supplied by requester | Pre-existing | QA-TC-003 | External | Retain | Credential value intentionally not recorded. |
| User credential | nurse@itera.health | Pre-existing | Role/API QA | External | Retain | Password intentionally not recorded. Working QA password variant used without trailing period. |
| User credential | democardiologist@itera.health | Pre-existing | Role/API QA | External | Retain | Password intentionally not recorded. |
| Patient | QA_AUTO_PATIENT_20260712135708 AUTOMATED | 2026-07-12 | Synthetic API QA | Created | Retain until audit sign-off | Created during first production write cycle. |
| Patient | QA_AUTO_PATIENT_20260712135837 AUTOMATED | 2026-07-12 | Synthetic API QA | Created | Retain until audit sign-off | Created during rerun. |
| Patient | QA_AUTO_PATIENT_20260712140159 AUTOMATED | 2026-07-12 | Synthetic API QA | Created | Retain until audit sign-off | Created during rerun. |
| Patient | QA_AUTO_PATIENT_20260712140417 AUTOMATED | 2026-07-12 | Synthetic API QA | Created | Retain until audit sign-off | Created during rerun. |
| Patient | QA_AUTO_PATIENT_20260712140647 AUTOMATED | 2026-07-12 | Synthetic API QA | Created | Retain until audit sign-off | Latest retained evidence record; details in `qa-evidence/logs/synthetic-data.json`. |
| Patient | QA_UI_* FULLFLOW | 2026-07-12/13 | Full UI journey QA | Created/Activated | Retain until audit sign-off | Multiple timestamped records created while reproducing and validating the full UI flow. Latest validated records reached consent PDF, RPM delivery PDF regeneration, and activation. |

Synthetic records are intentionally prefixed `QA_AUTO_` and retained as requested evidence. They are safe to delete after audit sign-off.
