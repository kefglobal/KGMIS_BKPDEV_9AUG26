/*
============================================================
KEFG MEMBER DATABASE MANAGER
MODULE 20
DATA DICTIONARY
Version 1.0
============================================================

PURPOSE

This document defines every field in the KEFG database.

Every future module MUST follow these definitions.

------------------------------------------------------------

SYSTEM FIELDS
------------------------------------------------------------

TEMP_ID
--------
Permanent identity of a person.
Never edited manually.
Will later become KEFG_ID.

MEMBER_CATEGORY
---------------
PRIMARY MEMBER
ALUMNI SPOUSE MEMBER
NON-ALUMNI SPOUSE

Determines membership category.

RELATED_KEFG_ID
---------------
Stores the TEMP_ID of the related spouse.

FAMILY_ID
---------
Permanent family identifier.

------------------------------------------------------------

DATE FIELDS
------------------------------------------------------------

MEMBER BIRTHDAY (Date and Month)
--------------------------------
Display field only.
Shows:
29 May

MEMBER_DOB_FULL
---------------
Internal field.
Stores:
29-May-1956

or

29-May-2000
if year is unknown.

SPOUSE BIRTHDAY (Date and Month)
--------------------------------
Display field.

SPOUSE_DOB_FULL
---------------
Internal field.

WEDDING DATE
------------
Display field.

WEDDING_DATE_FULL
-----------------
Internal field.

------------------------------------------------------------

DIRECTORY POLICY
------------------------------------------------------------

Initially

All members are visible.

Future

Directory access may be restricted according to subscription policy.

------------------------------------------------------------

ID POLICY
------------------------------------------------------------

TEMP_ID never changes after production freeze.

Founder Members

TEMP_001 – TEMP_040
reserved.

Regular Members

TEMP_041 onwards.

------------------------------------------------------------

DATABASE RULES
------------------------------------------------------------

Every person has

ONE TEMP_ID

Every family has

ONE FAMILY_ID

Every spouse relationship uses

RELATED_KEFG_ID

Every module uses

Preview
↓

Review
↓

Apply

Never modify production data directly.

============================================================
*/