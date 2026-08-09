/*
============================================================
KEFG MEMBER DATABASE POLICY
Version: 1.0
============================================================

1. TEMP_ID is the permanent internal identity of a member.

2. TEMP_ID must never be manually edited, deleted, reused, or reassigned.

3. Member_Name and other member details may be corrected later without changing TEMP_ID.

4. Only Apps Script may create new TEMP_IDs.

5. TEMP_ID column is treated as read-only.

6. TEMP_001 to TEMP_040 are reserved for Founder Members.

7. Regular automatic IDs must start from TEMP_041.

8. If a founder member is added later, the reserved ID must be assigned carefully through an approved founder-member process.

9. All imports, updates, searches, reports, and the future member app must use TEMP_ID as the primary key.

10. Sorting must always move the full row/table together.

11. Blank member rows must not receive TEMP_IDs.

12. Deleted member IDs must not be reused.

13. Future migration from TEMP_ID to KEFG_ID must preserve the numeric identity.

Example:
TEMP_041 may later become KEFG_041 or KEFG-000041.

============================================================
*/