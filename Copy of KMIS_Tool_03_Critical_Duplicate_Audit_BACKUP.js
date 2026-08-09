function KMIS_Run_Critical_Duplicate_Audit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const reportName = "KMIS_CRITICAL_DUPLICATES";

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found: " + masterName);

  const oldReport = ss.getSheetByName(reportName);
  if (oldReport) ss.deleteSheet(oldReport);

  const report = ss.insertSheet(reportName);

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();

  const headers = master.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  function col(header) {
    const i = headers.indexOf(header);
    if (i === -1) throw new Error("Header not found: " + header);
    return i;
  }

  const C = {
    TEMP_ID: col("TEMP_ID"),
    MEMBER_NAME: col("MEMBER_NAME"),
    MEMBER_WHATSAPP: col("MEMBER_WHATSAPP"),
    MEMBER_EMAIL: col("MEMBER_EMAIL")
  };

  const data = lastRow > 1
    ? master.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues()
    : [];

  const fieldsToCheck = [
    ["TEMP_ID", C.TEMP_ID],
    ["MEMBER_WHATSAPP", C.MEMBER_WHATSAPP],
    ["MEMBER_EMAIL", C.MEMBER_EMAIL]
  ];

  const ignoreValues = new Set([
    "",
    "na",
    "n/a",
    "not applicable",
    "nil",
    "none",
    "-"
  ]);

  const output = [[
    "ACTION",
    "DUPLICATE_TYPE",
    "MATCH_VALUE",
    "ROW_NUMBER",
    "TEMP_ID",
    "MEMBER_NAME",
    "MEMBER_WHATSAPP",
    "MEMBER_EMAIL"
  ]];

  fieldsToCheck.forEach(([fieldName, fieldIndex]) => {
    const map = {};

    data.forEach((row, i) => {
      const raw = String(row[fieldIndex] || "").trim();
      const key = raw.toLowerCase().replace(/\s+/g, " ");

      if (ignoreValues.has(key)) return;

      if (!map[key]) map[key] = [];
      map[key].push({ rowNumber: i + 2, row });
    });

    Object.keys(map).forEach(key => {
      if (map[key].length > 1) {
        map[key].forEach(item => {
          output.push([
            "REVIEW",
            fieldName,
            item.row[fieldIndex],
            item.rowNumber,
            item.row[C.TEMP_ID],
            item.row[C.MEMBER_NAME],
            item.row[C.MEMBER_WHATSAPP],
            item.row[C.MEMBER_EMAIL]
          ]);
        });
      }
    });
  });

  report.getRange(1, 1, output.length, output[0].length).setValues(output);
  report.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Critical Duplicate Audit Completed.\n\n" +
    "Records scanned: " + data.length + "\n" +
    "Duplicate rows listed: " + (output.length - 1)
  );
}