function KEFG_Profile_Date_Fields_FAST() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName = "KEFG_Test_Data_Rev_0.2";
  const reportSheetName = "KEFG_DATE_PROFILE";

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);

  const headersToCheck = [
    "MEMBER BIRTHDAY (Date and Month)",
    "SPOUSE BIRTHDAY (Date and Month)",
    "WEDDING DATE"
  ];

  let report = ss.getSheetByName(reportSheetName);
  if (report) report.clear();
  else report = ss.insertSheet(reportSheetName);

  const output = [[
    "FIELD_NAME",
    "DETECTED_TYPE",
    "COUNT",
    "EXAMPLES"
  ]];

  headersToCheck.forEach(header => {
    const col = KEFG_getColumnByHeader_(sheet, header);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
    const displays = sheet.getRange(2, col, lastRow - 1, 1).getDisplayValues();

    const summary = {};

    for (let i = 0; i < values.length; i++) {
      const rawValue = values[i][0];
      const displayValue = displays[i][0];

      const result = KEFG_Detect_Date_Value_Type_(rawValue, displayValue);
      const type = result.type;

      if (!summary[type]) {
        summary[type] = {
          count: 0,
          examples: []
        };
      }

      summary[type].count++;

      if (summary[type].examples.length < 5) {
        const ex = String(displayValue || rawValue || "").trim();
        if (ex !== "") summary[type].examples.push(ex);
      }
    }

    Object.keys(summary).forEach(type => {
      output.push([
        header,
        type,
        summary[type].count,
        summary[type].examples.join(", ")
      ]);
    });
  });

  report.getRange(1, 1, output.length, output[0].length).setValues(output);
  report.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Fast date profiling completed.\n\nCheck sheet: " + reportSheetName
  );
}