function KEFG_Spouse_Row_Already_Exists_(sheet, primaryId, spouseName) {
  const firstRow = KEFG_SPOUSE_CONFIG.FIRST_DATA_ROW;

  const memberNameCol = KEFG_Spouse_GetColumn_(
    sheet,
    KEFG_SPOUSE_CONFIG.HEADERS.MEMBER_NAME
  );

  const relatedIdCol = KEFG_Spouse_GetColumn_(
    sheet,
    KEFG_SPOUSE_CONFIG.HEADERS.RELATED_KEFG_ID
  );

  const lastRow = sheet.getLastRow();

  if (lastRow < firstRow) return false;

  const numRows = lastRow - firstRow + 1;

  const memberNames = sheet
    .getRange(firstRow, memberNameCol, numRows, 1)
    .getDisplayValues();

  const relatedIds = sheet
    .getRange(firstRow, relatedIdCol, numRows, 1)
    .getDisplayValues();

  const targetName = KEFG_Spouse_Normalize_(spouseName);
  const targetPrimaryId = String(primaryId || "").trim();

  for (let i = 0; i < numRows; i++) {
    const name = KEFG_Spouse_Normalize_(memberNames[i][0]);
    const relatedId = String(relatedIds[i][0] || "").trim();

    if (name === targetName && relatedId === targetPrimaryId) {
      return true;
    }
  }

  return false;
}