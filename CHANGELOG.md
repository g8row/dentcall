# Changelog

## [Unreleased]

### Added
- **Preferred Caller Assignment**: Implemented functionality to assign specific dentists to preferred callers (Dani and Ico).
  - Analyzed `klienti_dani.csv` and `klienti_ico.csv` to identify caller-specific dentists based on phone numbers.
  - Updated `dentists_cleaned.json` with `preferred_caller` field.
  - Updated database schema to include `preferred_caller_id` in `dentists` table.
  - Modified `scripts/import-data.ts` to map `preferred_caller` from JSON to User IDs in the database during import.
  - Updated assignment algorithm in `/api/assignments` to prioritize and restrict dentists to their preferred callers.
- **UI Indicators**:
  - **Caller Dashboard**: Added "Preferred" badge for assigned dentists.
  - **Schedule Planner**: Added stats for pending preferred dentists.
  - **Add Dentist**: Added ability to select preferred caller.
- **Fixes**:
  - Fixed Unicode escape sequence display for cities in Caller Dashboard and City filters.
  - Made "Add Dentist" button globally accessible in Admin Dashboard, not just on Calendar tab.
  - Enhanced Schedule Planner to show per-caller breakdown of preferred dentists in Region list, City list, and Totals.
  - Fixed Z-index/overflow clipping issues for preferred caller tooltips in Schedule Planner.
  - **Exports**: Updated Excel export to include "Preferred Caller" column.
  - **Exports**: Fixed issue where city names in Excel export were displayed as raw Unicode escape sequences.
