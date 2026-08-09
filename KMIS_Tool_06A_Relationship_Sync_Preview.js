function KMIS_Create_Relationship_Sync_Preview() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const previewName = "KMIS_RELATIONSHIP_FIX_PREVIEW";

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found: " + masterName);

  const oldPreview = ss.getSheetByName(previewName);
  if (oldPreview) ss.deleteSheet(oldPreview);
  const preview = ss.insertSheet(previewName);

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();
  const headers = master.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  function col(h) {
    const i = headers.indexOf(h);
    if (i === -1) throw new Error("Header not found: " + h);
    return i;
  }

  const C = {
    TEMP_ID: col("TEMP_ID"),
    RELATED_KEFG_ID: col("RELATED_KEFG_ID"),
    MEMBER_NAME: col("MEMBER_NAME"),
    MEMBER_CATEGORY: col("MEMBER_CATEGORY")
  };

  const data = lastRow > 1
    ? master.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues()
    : [];

  const idMap = {};
  data.forEach((row, i) => {
    const id = String(row[C.TEMP_ID] || "").trim();
    if (id) idMap[id] = { row, rowNumber: i + 2 };
  });

  const output = [[
    "ACTION",
    "TARGET_ROW",
    "TARGET_KEFG_ID",
    "TARGET_NAME",
    "TARGET_CATEGORY",
    "CURRENT_RELATED_KEFG_ID",
    "NEW_RELATED_KEFG_ID",
    "RELATED_NAME",
    "RELATED_CATEGORY",
    "REMARK"
  ]];

  data.forEach((row, i) => {
    const id = String(row[C.TEMP_ID] || "").trim();
    const relatedId = String(row[C.RELATED_KEFG_ID] || "").trim();

    if (!id || !relatedId) return;

    const related = idMap[relatedId];
    if (!related) return;

    const relatedCurrent = String(related.row[C.RELATED_KEFG_ID] || "").trim();

    if (relatedCurrent === id) return;

    if (relatedCurrent && relatedCurrent !== id) {
      output.push([
        "REVIEW",
        related.rowNumber,
        relatedId,
        related.row[C.MEMBER_NAME],
        related.row[C.MEMBER_CATEGORY],
        relatedCurrent,
        id,
        row[C.MEMBER_NAME],
        row[C.MEMBER_CATEGORY],
        "Related record already points to different ID"
      ]);
    } else {
      output.push([
        "APPLY",
        related.rowNumber,
        relatedId,
        related.row[C.MEMBER_NAME],
        related.row[C.MEMBER_CATEGORY],
        relatedCurrent,
        id,
        row[C.MEMBER_NAME],
        row[C.MEMBER_CATEGORY],
        "Missing reverse relationship"
      ]);
    }
  });

  preview.getRange(1, 1, output.length, output[0].length).setValues(output);
  preview.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Relationship sync preview created.\n\n" +
    "Rows listed: " + (output.length - 1) + "\n\n" +
    "No data has been changed."
  );
}
