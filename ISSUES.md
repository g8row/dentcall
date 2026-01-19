# Known Issues

## Data Quality
- **Phone Number Overlap**: Some phone numbers appear in both `klienti_dani.csv` and `klienti_ico.csv`. Currently handling this by assigning to the first match (Dani), but this needs conflict resolution policy.
- **Phone Formatting**: CSV files contain mixed formats (dashes, spaces, prefixes). The normalization script handles most, but edge cases might be missed.

## UX / UI
- **Large List Performance**: The `SchedulePlanner` and new Database Manager might be slow when rendering thousands of rows. Virtualization could be added in future.

## Implementation
- **User Lookup Logic**: The fuzzy matching for "Dani"/"Ico" during import is heuristic-based.
- **Backups**: Currently no automated offsite backup. Local backups rely on manual triggers or script execution.
