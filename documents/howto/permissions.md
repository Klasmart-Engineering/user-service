# Permissions 

## Overview

- Permissions originate from [a Google Sheet](https://docs.google.com/spreadsheets/d/1C1g-Q3UUsBBnDTXIFq75FSNdRN9Mr1qbJzyTYlpTePU)
- The user service stores .csv copies of this sheet in the repository:
    - `src/permissions/permissionInfo.csv` for application permissions (from Permission Details tab)
    - `tests/fixtures/permissions.csv` for tests (from Permission List tab)
- `src/permissions` contains a number of predefined, system roles with _manual_ mappings to permissions, e.g. `studentRole`
- On server startup, in `class RolesInitializer`:
    - permissions are read from the `src/permissions/permissionInfo.csv` file
    - permissions are inserted/updated in the `permission` table
    - predefined, hardcoded roles from `src/permissions` are added to the `role` table


## How to update permissions

- Overwrite `src/permissions/permissionInfo.csv` & `tests/fixtures/permissions.csv` by manually exporting new CSVs from the google sheet using the URLs in `tests/utils/latestPermissions.ts`
- Update predefined roles with changes using `npm run update-role-permissions`
  - check the result manually
- Update `src/permissions/permissionNames.ts` using `npm run update-permission-names`
- Run `npm run test` to validate changes against `tests/fixtures/permissions.csv`
