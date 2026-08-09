/**
 * ============================================================
 * 14_Member_Category.gs
 * KGMIS MEMBER CATEGORY ASSIGNMENT
 * ============================================================
 *
 * Sheet:
 *   KGMIS_MASTER_DATABASE_v1.0
 *
 * Categories:
 *   1. PRIMARY MEMBER
 *   2. ALUMNI SPOUSE MEMBER
 *   3. NON-ALUMNI SPOUSE
 *
 * Current KGMIS headers used:
 *   MEMBER_NAME
 *   SPOUSE_NAME
 *   SPOUSE_ALUMNI_ASSOCIATION
 *   MEMBER_CATEGORY
 *
 * Logic:
 *   - Original member records are classified as PRIMARY MEMBER.
 *   - Separate spouse records are identified by matching their
 *     MEMBER_NAME with the SPOUSE_NAME contained in an original
 *     member record.
 *   - Spouses belonging to an approved alumni association are
 *     classified as ALUMNI SPOUSE MEMBER.
 *   - All other spouses are classified as NON-ALUMNI SPOUSE.
 * ============================================================
 */

function KEFG_Assign_Member_Categories() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName = "KGMIS_MASTER_DATABASE_v1.0";
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      'Sheet "' + sheetName + '" was not found.'
    );
  }

  const firstDataRow = 2;
  const lastRow = sheet.getLastRow();

  if (lastRow < firstDataRow) {
    SpreadsheetApp.getUi().alert(
      "No member records were found in " + sheetName + "."
    );
    return;
  }

  /*
   * ==========================================================
   * FIND REQUIRED COLUMNS
   * ==========================================================
   */

  const memberNameCol = KEFG_getColumnByHeader_(
    sheet,
    "MEMBER_NAME"
  );

  const spouseNameCol = KEFG_getColumnByHeader_(
    sheet,
    "SPOUSE_NAME"
  );

  const spouseAlumniCol = KEFG_getColumnByHeader_(
    sheet,
    "SPOUSE_ALUMNI_ASSOCIATION"
  );

  const categoryCol = KEFG_getColumnByHeader_(
    sheet,
    "MEMBER_CATEGORY"
  );

  /*
   * Alumni associations whose spouses qualify as
   * ALUMNI SPOUSE MEMBER.
   */
  const allowedAlumniAssociations = [
    "AECK",
    "CETA",
    "KEA",
    "MACE",
    "NIT",
    "NSSCE",
    "TEC",
    "TKMCE"
  ];

  const numRows = lastRow - firstDataRow + 1;

  /*
   * ==========================================================
   * READ DATA
   * ==========================================================
   */

  const memberNames = sheet
    .getRange(
      firstDataRow,
      memberNameCol,
      numRows,
      1
    )
    .getDisplayValues();

  const spouseNames = sheet
    .getRange(
      firstDataRow,
      spouseNameCol,
      numRows,
      1
    )
    .getDisplayValues();

  const spouseAlumniAssociations = sheet
    .getRange(
      firstDataRow,
      spouseAlumniCol,
      numRows,
      1
    )
    .getDisplayValues();

  /*
   * This array will contain the final category assigned
   * to every row.
   */
  const categories = Array.from(
    { length: numRows },
    function () {
      return [""];
    }
  );

  /*
   * ==========================================================
   * FIRST PASS
   *
   * Build a map containing every spouse name and the category
   * that should be assigned to the spouse's separate record.
   *
   * Example:
   *
   * shobha annie george -> NON-ALUMNI SPOUSE
   * ==========================================================
   */

  const spouseCategoryByName = {};

  for (let i = 0; i < numRows; i++) {
    const memberName = cleanCategoryText_(
      memberNames[i][0]
    );

    const spouseName = cleanCategoryText_(
      spouseNames[i][0]
    );

    const spouseAlumni = cleanCategoryText_(
      spouseAlumniAssociations[i][0]
    ).toUpperCase();

    /*
     * Ignore blank database rows.
     */
    if (!memberName) {
      continue;
    }

    /*
     * A row without a spouse name does not contribute anything
     * to the spouse-name map.
     */
    if (!spouseName) {
      continue;
    }

    const spouseKey =
      normalizeNameForCategory_(spouseName);

    if (!spouseKey) {
      continue;
    }

    if (
      allowedAlumniAssociations.includes(
        spouseAlumni
      )
    ) {
      spouseCategoryByName[spouseKey] =
        "ALUMNI SPOUSE MEMBER";
    } else {
      spouseCategoryByName[spouseKey] =
        "NON-ALUMNI SPOUSE";
    }
  }

  /*
   * ==========================================================
   * SECOND PASS
   *
   * Assign MEMBER_CATEGORY to every database row.
   * ==========================================================
   */

  let primaryMemberCount = 0;
  let alumniSpouseCount = 0;
  let nonAlumniSpouseCount = 0;
  let blankRowCount = 0;

  for (let i = 0; i < numRows; i++) {
    const memberName = cleanCategoryText_(
      memberNames[i][0]
    );

    const ownSpouseName = cleanCategoryText_(
      spouseNames[i][0]
    );

    /*
     * Leave the category blank when MEMBER_NAME is blank.
     */
    if (!memberName) {
      categories[i][0] = "";
      blankRowCount++;
      continue;
    }

    const memberKey =
      normalizeNameForCategory_(memberName);

    const matchedSpouseCategory =
      spouseCategoryByName[memberKey] || "";

    /*
     * Generated spouse records normally have SPOUSE_NAME blank.
     *
     * Therefore, a row is treated as a spouse record when:
     *
     * 1. Its MEMBER_NAME appears as SPOUSE_NAME in another row;
     * 2. Its own SPOUSE_NAME field is blank.
     */
    const isSpouseRecord =
      ownSpouseName === "" &&
      matchedSpouseCategory !== "";

    if (isSpouseRecord) {
      categories[i][0] =
        matchedSpouseCategory;

      if (
        matchedSpouseCategory ===
        "ALUMNI SPOUSE MEMBER"
      ) {
        alumniSpouseCount++;
      } else {
        nonAlumniSpouseCount++;
      }

      continue;
    }

    categories[i][0] = "PRIMARY MEMBER";
    primaryMemberCount++;
  }

  /*
   * ==========================================================
   * WRITE RESULTS
   * ==========================================================
   */

  sheet
    .getRange(
      firstDataRow,
      categoryCol,
      numRows,
      1
    )
    .setValues(categories);

  SpreadsheetApp.flush();

  /*
   * ==========================================================
   * COMPLETION REPORT
   * ==========================================================
   */

  SpreadsheetApp.getUi().alert(
    "MEMBER_CATEGORY assignment completed.\n\n" +
    "Sheet: " +
    sheetName +
    "\n\n" +
    "PRIMARY MEMBER: " +
    primaryMemberCount +
    "\n" +
    "ALUMNI SPOUSE MEMBER: " +
    alumniSpouseCount +
    "\n" +
    "NON-ALUMNI SPOUSE: " +
    nonAlumniSpouseCount +
    "\n" +
    "Blank rows skipped: " +
    blankRowCount
  );
}


/**
 * ============================================================
 * NORMALISE NAME FOR MATCHING
 * ============================================================
 *
 * Examples:
 *
 * "  Shobha   Annie George "
 * becomes:
 * "shobha annie george"
 *
 * "GEORGE P.C."
 * becomes:
 * "george pc"
 */
function normalizeNameForCategory_(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ");
}


/**
 * ============================================================
 * CLEAN GENERAL TEXT
 * ============================================================
 */
function cleanCategoryText_(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Returns the 1-based column number for the requested header.
 * The script continues to work even when columns are rearranged
 * or new columns are inserted.
 */
function KEFG_getColumnByHeader_(sheet, headerName) {
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    throw new Error(
      'The sheet "' + sheet.getName() + '" has no columns.'
    );
  }

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];

  const normalizedTarget = String(headerName)
    .trim()
    .toUpperCase();

  const columnIndex = headers.findIndex(function (header) {
    return String(header)
      .trim()
      .toUpperCase() === normalizedTarget;
  });

  if (columnIndex === -1) {
    throw new Error(
      'Header "' +
      headerName +
      '" was not found in sheet "' +
      sheet.getName() +
      '".'
    );
  }

  return columnIndex + 1;
}

