function KMIS_Apply_Relationship_Sync() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const previewName = "KMIS_RELATIONSHIP_FIX_PREVIEW";

  const master = ss.getSheetByName(masterName);
  const preview = ss.getSheetByName(previewName);

  if (!master) throw new Error("Master sheet not found: " + masterName);
  if (!preview) throw new Error("Preview sheet not found: " + previewName);

  const previewData = preview.getDataRange().getDisplayValues();
  const headers = previewData[0];

  const actionCol = headers.indexOf("ACTION");
  const targetRowCol = headers.indexOf("TARGET_ROW");
  const newRelatedCol = headers.indexOf("NEW_RELATED_KEFG_ID");

  if (actionCol === -1 || targetRowCol === -1 || newRelatedCol === -1) {
    throw new Error("Required preview columns not found.");
  }

  const masterHeaders = master
    .getRange(1, 1, 1, master.getLastColumn())
    .getDisplayValues()[0];

  const relatedCol = masterHeaders.indexOf("RELATED_KEFG_ID") + 1;

  if (relatedCol === 0) {
    throw new Error("RELATED_KEFG_ID column not found in master.");
  }

  let updated = 0;
  let skipped = 0;

  for (let i = 1; i < previewData.length; i++) {
    const action = String(previewData[i][actionCol] || "").trim().toUpperCase();
    const targetRow = Number(previewData[i][targetRowCol]);
    const newRelated = String(previewData[i][newRelatedCol] || "").trim();

    if (action === "APPLY" && targetRow && newRelated) {
      master.getRange(targetRow, relatedCol).setValue(newRelated);
      updated++;
    } else {
      skipped++;
    }
  }

  SpreadsheetApp.getUi().alert(
    "Relationship sync applied.\n\n" +
    "Rows updated: " + updated + "\n" +
    "Rows skipped: " + skipped
  );
}