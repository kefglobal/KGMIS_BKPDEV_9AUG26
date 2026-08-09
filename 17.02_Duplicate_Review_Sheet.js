function KEFG_Duplicate_Create_Review_Sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let reviewSheet = ss.getSheetByName(KEFG_DUPLICATE.REVIEW_SHEET);

  if (reviewSheet) {
    reviewSheet.clear();
  } else {
    reviewSheet = ss.insertSheet(KEFG_DUPLICATE.REVIEW_SHEET);
  }

  const headers = [
    "ACTION",
    "DUPLICATE_TYPE",
    "MATCH_VALUE",
    "ROW_NUMBER",
    "TEMP_ID",
    "MEMBER_NAME",
    "MEMBER_CATEGORY",
    "MEMBER_MOBILE",
    "WHATSAPP_NUMBER",
    "MEMBER_EMAIL",
    "RELATED_KEFG_ID",
    "NOTES"
  ];

  reviewSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  reviewSheet.setFrozenRows(1);

  return reviewSheet;
}