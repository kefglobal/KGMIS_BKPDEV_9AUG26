function KEFG_Profile_Date_Fields() {
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
  if (report) {
    report.clear();
  } else {
    report = ss.insertSheet(reportSheetName);
  }

  const output = [[
    "FIELD_NAME",
    "ROW_NUMBER",
    "CELL_VALUE",
    "DISPLAY_VALUE",
    "DETECTED_TYPE",
    "NOTES"
  ]];

  headersToCheck.forEach(header => {
    const col = KEFG_getColumnByHeader_(sheet, header);
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) return;

    const values = sheet.getRange(2, col, lastRow - 1, 1).getValues();
    const displays = sheet.getRange(2, col, lastRow - 1, 1).getDisplayValues();

    for (let i = 0; i < values.length; i++) {
      const rowNumber = i + 2;
      const rawValue = values[i][0];
      const displayValue = displays[i][0];

      const result = KEFG_Detect_Date_Value_Type_(rawValue, displayValue);

      output.push([
        header,
        rowNumber,
        rawValue,
        displayValue,
        result.type,
        result.note
      ]);
    }
  });

  report.getRange(1, 1, output.length, output[0].length).setValues(output);
  report.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Date profiling completed.\n\nCheck sheet: " + reportSheetName
  );
}

function KEFG_Detect_Date_Value_Type_(rawValue, displayValue) {
  const display = String(displayValue || "").trim();

  if (display === "") {
    return { type: "BLANK", note: "" };
  }

  if (rawValue instanceof Date) {
    return { type: "REAL_DATE", note: "Stored as Google Sheets date." };
  }

  if (typeof rawValue === "number") {
    return {
      type: "NUMBER_OR_DATE_SERIAL",
      note: "May be date serial or numeric value. Check formatting."
    };
  }

  if (/^\$?\d{1,3}(,\d{3})*(\.\d+)?$/.test(display)) {
    return {
      type: "CURRENCY_OR_NUMBER_DISPLAY",
      note: "Likely date serial displayed as currency/number."
    };
  }

  if (/^\d{1,2}[-/.]\d{1,2}$/.test(display)) {
    return { type: "DAY_MONTH_NUMERIC", note: "Example: 29-05, 29/05, 29.05" };
  }

  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(display)) {
    return { type: "FULL_DATE_NUMERIC", note: "Example: 25.05.1956" };
  }

  if (/^\d{1,2}(st|nd|rd|th)?\s+[A-Za-z]+$/i.test(display)) {
    return { type: "DAY_MONTH_TEXT", note: "Example: 12th May, 16 August" };
  }

  if (/^[A-Za-z]+\s+\d{1,2}$/i.test(display)) {
    return { type: "MONTH_DAY_TEXT", note: "Example: May 12" };
  }

  if (/^(n\/a|na|not applicable)$/i.test(display)) {
    return { type: "NOT_APPLICABLE", note: "" };
  }

  return { type: "UNKNOWN", note: "Needs manual review." };
}