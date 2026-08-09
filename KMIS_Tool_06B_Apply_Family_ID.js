function KMIS_Apply_Family_ID() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const previewName = "KMIS_FAMILY_ID_PREVIEW";

  const master = ss.getSheetByName(masterName);
  const preview = ss.getSheetByName(previewName);

  if (!master) throw new Error("Master sheet not found.");
  if (!preview) throw new Error("Preview sheet not found.");

  const previewData = preview.getDataRange().getDisplayValues();
  const pHeaders = previewData[0];

  const pTemp = pHeaders.indexOf("TEMP_ID");
  const pFamily = pHeaders.indexOf("NEW_FAMILY_ID");

  if (pTemp === -1 || pFamily === -1) {
    throw new Error("TEMP_ID or NEW_FAMILY_ID not found in preview.");
  }

  const familyMap = {};

  for (let i = 1; i < previewData.length; i++) {

    const tempId = String(previewData[i][pTemp] || "").trim();
    const familyId = String(previewData[i][pFamily] || "").trim();

    if (tempId && familyId) {
      familyMap[tempId] = familyId;
    }

  }

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();

  const headers = master.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  const tempCol = headers.indexOf("TEMP_ID");
  const familyCol = headers.indexOf("FAMILY_ID");

  if (tempCol === -1 || familyCol === -1) {
    throw new Error("TEMP_ID or FAMILY_ID column missing.");
  }

  const range = master.getRange(2, 1, lastRow - 1, lastCol);
  const values = range.getDisplayValues();

  let updated = 0;

  for (let i = 0; i < values.length; i++) {

    const id = String(values[i][tempCol] || "").trim();

    if (familyMap[id]) {
      values[i][familyCol] = familyMap[id];
      updated++;
    }

  }

  range.setValues(values);

  SpreadsheetApp.getUi().alert(
    "Family IDs applied successfully.\n\n" +
    "Rows updated : " + updated
  );

}