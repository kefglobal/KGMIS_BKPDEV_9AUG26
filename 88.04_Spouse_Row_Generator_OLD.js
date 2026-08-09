function KEFG_Create_All_Spouse_Person_Rows_v2() {
  const sheet = KEFG_Spouse_GetSheet_();
  const H = KEFG_SPOUSE_CONFIG.HEADERS;

  const firstRow = KEFG_SPOUSE_CONFIG.FIRST_DATA_ROW;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const col = {};
  Object.keys(H).forEach(k => col[k] = KEFG_Spouse_GetColumn_(sheet, H[k]));

  const data = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, lastCol).getValues();

  const output = [];
  let inserted = 0, alumni = 0, nonAlumni = 0, skippedBlank = 0, skippedNoId = 0;

  data.forEach(row => {
    output.push(row);

    const primaryId = String(row[col.TEMP_ID - 1] || "").trim();
    const spouseName = String(row[col.SPOUSE_NAME - 1] || "").trim();

    if (!spouseName) {
      skippedBlank++;
      return;
    }

    if (!primaryId) {
      skippedNoId++;
      return;
    }

    const spouseAlumni = row[col.SPOUSE_ALUMNI - 1];
    const spouseCategory = KEFG_Spouse_IsAllowedAlumni_(spouseAlumni)
      ? KEFG_SPOUSE_CONFIG.CATEGORY_ALUMNI_SPOUSE
      : KEFG_SPOUSE_CONFIG.CATEGORY_NON_ALUMNI_SPOUSE;

    const newRow = new Array(lastCol).fill("");

    newRow[col.MEMBER_NAME - 1] = row[col.SPOUSE_NAME - 1];
    newRow[col.MEMBER_MOBILE - 1] = row[col.SPOUSE_MOBILE - 1];
    const spouseAlumniValue = String(row[col.SPOUSE_ALUMNI - 1] || "").trim().toUpperCase();

newRow[col.ALUMNI - 1] = KEFG_Spouse_IsAllowedAlumni_(spouseAlumniValue)
  ? spouseAlumniValue
  : "Not Applicable";
    newRow[col.CURRENT_DISTRICT - 1] = row[col.SPOUSE_DISTRICT - 1];
    newRow[col.ACTIVITIES - 1] = row[col.SPOUSE_ACTIVITIES - 1];
    newRow[col.MEMBER_BIRTHDAY - 1] = row[col.SPOUSE_BIRTHDAY - 1];
    newRow[col.WEDDING_DATE - 1] = row[col.WEDDING_DATE - 1];
    newRow[col.ZONE - 1] = row[col.ZONE - 1];
    newRow[col.SUBSCRIPTION_2026 - 1] = row[col.SUBSCRIPTION_2026 - 1];
    newRow[col.SUBSCRIPTION_2025 - 1] = row[col.SUBSCRIPTION_2025 - 1];
    newRow[col.WHATSAPP_NUMBER - 1] = row[col.WHATSAPP_NUMBER - 1];
    newRow[col.YEAR_BATCH - 1] = row[col.SPOUSE_BATCH - 1];
    newRow[col.PROFESSION - 1] = row[col.SPOUSE_PROFESSION - 1];
    newRow[col.CONTRIBUTIONS - 1] = row[col.SPOUSE_CONTRIBUTIONS - 1];
    newRow[col.VOLUNTEER - 1] = row[col.SPOUSE_VOLUNTEER - 1];
    newRow[col.BRANCH - 1] = row[col.SPOUSE_BRANCH - 1];
    newRow[col.CONSENT - 1] = row[col.CONSENT - 1];

    newRow[col.MEMBER_CATEGORY - 1] = spouseCategory;
    newRow[col.RELATED_KEFG_ID - 1] = primaryId;
    newRow[col.FAMILY_ID - 1] = "";

    row[col.MEMBER_CATEGORY - 1] = KEFG_SPOUSE_CONFIG.CATEGORY_PRIMARY;

    output[output.length - 1] = row;
    output.push(newRow);

    inserted++;
    if (spouseCategory === KEFG_SPOUSE_CONFIG.CATEGORY_ALUMNI_SPOUSE) alumni++;
    else nonAlumni++;
  });

  sheet.getRange(firstRow, 1, data.length, lastCol).clearContent();
  sheet.getRange(firstRow, 1, output.length, lastCol).setValues(output);

  SpreadsheetApp.getUi().alert(
    "Spouse rows created successfully.\n\n" +
    "Rows inserted: " + inserted + "\n" +
    "Alumni spouse members: " + alumni + "\n" +
    "Non-alumni spouses: " + nonAlumni + "\n" +
    "Rows skipped - blank spouse name: " + skippedBlank + "\n" +
    "Rows skipped - missing TEMP_ID: " + skippedNoId + "\n\n" +
    "Now run: KEFG Database → Assign Missing TEMP IDs"
  );
}