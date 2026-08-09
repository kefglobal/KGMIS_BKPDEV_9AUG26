function KMIS_List_Alumni_Spouses_With_Member_Spouses() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const outputName = "KMIS_ALUMNI_SPOUSE_LIST";

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found: " + masterName);

  let out = ss.getSheetByName(outputName);
  if (out) out.clear();
  else out = ss.insertSheet(outputName);

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
    MEMBER_CATEGORY: col("MEMBER_CATEGORY"),
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

  const idMap = {};

  data.forEach(row => {
    const id = String(row[C.TEMP_ID] || "").trim();
    if (id) idMap[id] = row;
  });

  const output = [[
    "ALUMNI_SPOUSE_TEMP_ID",
    "ALUMNI_SPOUSE_NAME",
    "ALUMNI_SPOUSE_ALUMNI",
    "ALUMNI_SPOUSE_BRANCH",
    "ALUMNI_SPOUSE_YEAR_BATCH",
    "ALUMNI_SPOUSE_MOBILE",
    "RELATED_MEMBER_TEMP_ID",
    "RELATED_MEMBER_NAME",
    "RELATED_MEMBER_CATEGORY",
    "RELATED_MEMBER_MOBILE",
    "RELATED_MEMBER_WHATSAPP",
    "RELATED_MEMBER_EMAIL",
    "REMARK"
  ]];

  data.forEach(row => {
    const category = String(row[C.MEMBER_CATEGORY] || "").trim().toUpperCase();

    if (category === "ALUMNI SPOUSE MEMBER") {
      const relatedId = String(row[C.RELATED_KEFG_ID] || "").trim();
      const related = idMap[relatedId];

      output.push([
        row[C.TEMP_ID],
        row[C.MEMBER_NAME],
        row[C.ALUMNI_ASSOCIATION],
        row[C.BRANCH],
        row[C.YEAR_BATCH],
        row[C.MEMBER_MOBILE],
        relatedId,
        related ? related[C.MEMBER_NAME] : "",
        related ? related[C.MEMBER_CATEGORY] : "",
        related ? related[C.MEMBER_MOBILE] : "",
        related ? related[C.MEMBER_WHATSAPP] : "",
        related ? related[C.MEMBER_EMAIL] : "",
        related ? "" : "RELATED_KEFG_ID not found"
      ]);
    }
  });

  out.getRange(1, 1, output.length, output[0].length).setValues(output);
  out.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Alumni spouse list created.\n\n" +
    "Rows listed: " + (output.length - 1) + "\n\n" +
    "Sheet: " + outputName
  );
}