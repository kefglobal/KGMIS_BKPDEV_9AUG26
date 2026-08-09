function KMIS_Run_Duplicate_Name_Review() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const reportName = "KMIS_DUPLICATE_NAME_REVIEW";

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
    RELATED_KEFG_ID: col("RELATED_KEFG_ID"),
    MEMBER_NAME: col("MEMBER_NAME"),
    MEMBER_MOBILE: col("MEMBER_MOBILE"),
    MEMBER_WHATSAPP: col("MEMBER_WHATSAPP"),
    MEMBER_EMAIL: col("MEMBER_EMAIL"),
    ALUMNI_ASSOCIATION: col("ALUMNI_ASSOCIATION"),
    BRANCH: col("BRANCH"),
    YEAR_BATCH: col("YEAR_BATCH")
  };

  const data = lastRow > 1
    ? master.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues()
    : [];

  const map = {};

  data.forEach((row, i) => {
    const name = String(row[C.MEMBER_NAME] || "").trim();
    if (!name) return;

    const key = name.toLowerCase().replace(/\s+/g, " ");

    if (!map[key]) map[key] = [];
    map[key].push({ rowNumber: i + 2, row });
  });

  const output = [[
    "ACTION",
    "MATCH_NAME",
    "ROW_NUMBER",
    "TEMP_ID",
    "RELATED_KEFG_ID",
    "MEMBER_NAME",
    "MEMBER_MOBILE",
    "MEMBER_WHATSAPP",
    "MEMBER_EMAIL",
    "ALUMNI_ASSOCIATION",
    "BRANCH",
    "YEAR_BATCH",
    "REMARK"
  ]];

  Object.keys(map).forEach(key => {
    if (map[key].length > 1) {
      map[key].forEach(item => {
        output.push([
          "REVIEW",
          item.row[C.MEMBER_NAME],
          item.rowNumber,
          item.row[C.TEMP_ID],
          item.row[C.RELATED_KEFG_ID],
          item.row[C.MEMBER_NAME],
          item.row[C.MEMBER_MOBILE],
          item.row[C.MEMBER_WHATSAPP],
          item.row[C.MEMBER_EMAIL],
          item.row[C.ALUMNI_ASSOCIATION],
          item.row[C.BRANCH],
          item.row[C.YEAR_BATCH],
          "Same member name found"
        ]);
      });
    }
  });

  report.getRange(1, 1, output.length, output[0].length).setValues(output);
  report.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Duplicate Name Review completed.\n\n" +
    "Records scanned: " + data.length + "\n" +
    "Duplicate name rows listed: " + (output.length - 1)
  );
}