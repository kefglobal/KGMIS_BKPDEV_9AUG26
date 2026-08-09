function KEFG_Create_Date_Cleanup_Preview() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = KEFG_Date_GetSheet_();

  let preview = ss.getSheetByName(KEFG_DATE.PREVIEW_SHEET);
  if (preview) preview.clear();
  else preview = ss.insertSheet(KEFG_DATE.PREVIEW_SHEET);

  const firstRow = KEFG_DATE.FIRST_DATA_ROW;
  const lastRow = sheet.getLastRow();

  const tempIdCol = KEFG_Date_GetColumn_(sheet, "TEMP_ID");

  const output = [[
    "ACTION",
    "TEMP_ID",
    "ROW_NUMBER",
    "FIELD",
    "FULL_FIELD",
    "CURRENT VALUE",
    "NEW VALUE",
    "NEW FULL VALUE",
    "STATUS",
    "REMARK"
  ]];

  KEFG_DATE.FIELDS.forEach(field => {
    const displayCol = KEFG_Date_GetColumn_(sheet, field.displayHeader);
    const count = lastRow - firstRow + 1;

    const tempIds = sheet.getRange(firstRow, tempIdCol, count, 1).getDisplayValues();
    const values = sheet.getRange(firstRow, displayCol, count, 1).getValues();
    const displays = sheet.getRange(firstRow, displayCol, count, 1).getDisplayValues();

    for (let i = 0; i < count; i++) {
      const current = String(displays[i][0] || "").trim();
      if (current === "") continue;

      const result = KEFG_Date_Parse_Value_(values[i][0], displays[i][0]);
      const rowNumber = firstRow + i;
      const tempId = String(tempIds[i][0] || "").trim();

      if (result.status === "READY") {
        output.push([
          "APPLY",
          tempId,
          rowNumber,
          field.displayHeader,
          field.fullHeader,
          current,
          result.displayDate,
          KEFG_Date_Format_(result.fullDate, KEFG_DATE.FULL_FORMAT),
          "READY",
          ""
        ]);
      } else if (result.status === "REVIEW") {
        output.push([
          "REVIEW",
          tempId,
          rowNumber,
          field.displayHeader,
          field.fullHeader,
          current,
          "",
          "",
          "REVIEW",
          "Could not safely parse"
        ]);
      }
    }
  });

  preview.getRange(1, 1, output.length, output[0].length).setValues(output);
  preview.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "NEW date cleanup preview created with TEMP_ID.\n\nRows listed: " + (output.length - 1)
  );
}