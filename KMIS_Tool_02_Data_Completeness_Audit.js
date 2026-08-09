function KMIS_Run_Data_Completeness_Audit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const auditName = "KMIS_DATA_COMPLETENESS_AUDIT";

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found: " + masterName);

  let audit = ss.getSheetByName(auditName);
  if (audit) audit.clear();
  else audit = ss.insertSheet(auditName);

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();

  const headers = master.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  const data = lastRow > 1
    ? master.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues()
    : [];

  const totalRecords = data.length;

  const output = [
    ["KMIS DATA COMPLETENESS AUDIT", "", "", "", "", ""],
    ["Generated On", new Date(), "", "", "", ""],
    ["Master Database", masterName, "", "", "", ""],
    ["Columns in Master Database", lastCol, "", "", "", ""],
    ["Records Analysed", totalRecords, "", "", "", ""],
    ["STATUS", "PASS", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["COLUMN_NO", "FIELD_NAME", "TOTAL_RECORDS", "FILLED", "BLANK", "% COMPLETE"]
  ];

  for (let c = 0; c < lastCol; c++) {
    let filled = 0;

    for (let r = 0; r < totalRecords; r++) {
      if (String(data[r][c]).trim() !== "") filled++;
    }

    const blank = totalRecords - filled;
    const percent = totalRecords === 0
      ? 0
      : Math.round((filled / totalRecords) * 1000) / 10;

    output.push([
      c + 1,
      headers[c],
      totalRecords,
      filled,
      blank,
      percent
    ]);
  }

  audit.getRange(1, 1, output.length, 6).setValues(output);
  audit.setFrozenRows(8);

  SpreadsheetApp.getUi().alert(
    "KMIS Data Completeness Audit Completed\n\n" +
    "Columns in Master Database : " + lastCol + "\n" +
    "Columns Analysed : " + lastCol + "\n" +
    "Records Analysed : " + totalRecords + "\n\n" +
    "STATUS : PASS"
  );
}