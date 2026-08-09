function KEFG_Run_Duplicate_Review() {
  const sheet = KEFG_Duplicate_GetMasterSheet_();
  const reviewSheet = KEFG_Duplicate_Create_Review_Sheet_();

  const firstRow = KEFG_DUPLICATE.FIRST_DATA_ROW;
  const lastRow = sheet.getLastRow();

  if (lastRow < firstRow) {
    SpreadsheetApp.getUi().alert("No data found.");
    return;
  }

  const cols = {
    tempId: KEFG_Duplicate_GetColumn_(sheet, "TEMP_ID"),
    name: KEFG_Duplicate_GetColumn_(sheet, "Member_Name"),
    category: KEFG_Duplicate_GetColumn_(sheet, "MEMBER_CATEGORY"),
    mobile: KEFG_Duplicate_GetColumn_(sheet, "Member Mobile"),
    whatsapp: KEFG_Duplicate_GetColumn_(sheet, "WhatsApp Number"),
    email: KEFG_Duplicate_GetColumn_(sheet, "Member Email"),
    related: KEFG_Duplicate_GetColumn_(sheet, "RELATED_KEFG_ID")
  };

  const numRows = lastRow - firstRow + 1;
  const data = sheet.getRange(firstRow, 1, numRows, sheet.getLastColumn()).getDisplayValues();

  const output = [];

  scanDuplicateField_(data, output, cols, "TEMP_ID", cols.tempId, true);
  scanDuplicateField_(data, output, cols, "MEMBER_NAME", cols.name, false);
  scanDuplicateField_(data, output, cols, "MEMBER_MOBILE", cols.mobile, true);
  scanDuplicateField_(data, output, cols, "WHATSAPP_NUMBER", cols.whatsapp, true);
  scanDuplicateField_(data, output, cols, "MEMBER_EMAIL", cols.email, true);

  if (output.length > 0) {
    reviewSheet.getRange(2, 1, output.length, 12).setValues(output);
  }

  SpreadsheetApp.getUi().alert(
    "Duplicate review completed.\n\n" +
    "Possible duplicate entries found: " + output.length + "\n\n" +
    "Check sheet: KEFG_DUPLICATE_REVIEW"
  );
}

function scanDuplicateField_(data, output, cols, duplicateType, fieldCol, exactOnly) {
  const seen = {};

  for (let i = 0; i < data.length; i++) {
    const value = String(data[i][fieldCol - 1] || "").trim();
    if (!value) continue;

    const key = exactOnly
      ? value.toLowerCase()
      : KEFG_Duplicate_Normalize_(value);

    if (!seen[key]) {
      seen[key] = [];
    }

    seen[key].push({
      rowNumber: i + KEFG_DUPLICATE.FIRST_DATA_ROW,
      row: data[i],
      value: value
    });
  }

  Object.keys(seen).forEach(key => {
    if (seen[key].length > 1) {
      seen[key].forEach(item => {
        output.push([
          "REVIEW",
          duplicateType,
          item.value,
          item.rowNumber,
          item.row[cols.tempId - 1],
          item.row[cols.name - 1],
          item.row[cols.category - 1],
          item.row[cols.mobile - 1],
          item.row[cols.whatsapp - 1],
          item.row[cols.email - 1],
          item.row[cols.related - 1],
          ""
        ]);
      });
    }
  });
}