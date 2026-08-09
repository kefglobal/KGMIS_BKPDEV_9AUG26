function KMIS_Apply_KEFG_ID_Assignment() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const previewName = "KMIS_KEFG_ID_PREVIEW";
  const mappingName = "KMIS_KEFG_ID_MAPPING";

  const master = ss.getSheetByName(masterName);
  const preview = ss.getSheetByName(previewName);

  if (!master) throw new Error("Master sheet not found: " + masterName);
  if (!preview) throw new Error("Preview sheet not found: " + previewName);

  const previewData = preview.getDataRange().getDisplayValues();
  const pHeaders = previewData[0];

  const pOld = pHeaders.indexOf("OLD_TEMP_ID");
  const pNew = pHeaders.indexOf("NEW_KEFG_ID");
  const pOldRel = pHeaders.indexOf("OLD_RELATED_KEFG_ID");
  const pNewRel = pHeaders.indexOf("NEW_RELATED_KEFG_ID");

  if (pOld === -1 || pNew === -1 || pOldRel === -1 || pNewRel === -1) {
    throw new Error("Required columns missing in preview sheet.");
  }

  const oldToNew = {};

  for (let i = 1; i < previewData.length; i++) {
    const oldId = String(previewData[i][pOld] || "").trim();
    const newId = String(previewData[i][pNew] || "").trim();

    if (oldId && newId) {
      oldToNew[oldId] = newId;
    }
  }

  const masterLastRow = master.getLastRow();
  const masterLastCol = master.getLastColumn();

  const headers = master.getRange(1, 1, 1, masterLastCol).getDisplayValues()[0];

  const tempIdCol = headers.indexOf("TEMP_ID");
  const relatedCol = headers.indexOf("RELATED_KEFG_ID");

  if (tempIdCol === -1) throw new Error("TEMP_ID column not found in master.");
  if (relatedCol === -1) throw new Error("RELATED_KEFG_ID column not found in master.");

  const range = master.getRange(2, 1, masterLastRow - 1, masterLastCol);
  const data = range.getDisplayValues();

  let updatedIds = 0;
  let updatedRelated = 0;
  let missingMap = 0;

  for (let r = 0; r < data.length; r++) {
    const oldId = String(data[r][tempIdCol] || "").trim();
    const oldRel = String(data[r][relatedCol] || "").trim();

    if (oldId && oldToNew[oldId]) {
      data[r][tempIdCol] = oldToNew[oldId];
      updatedIds++;
    } else if (oldId) {
      missingMap++;
    }

    if (oldRel && oldToNew[oldRel]) {
      data[r][relatedCol] = oldToNew[oldRel];
      updatedRelated++;
    }
  }

  range.setValues(data);

  const existingMapping = ss.getSheetByName(mappingName);
  if (existingMapping) ss.deleteSheet(existingMapping);

  const mapping = preview.copyTo(ss).setName(mappingName);

  SpreadsheetApp.getUi().alert(
    "KEFG ID assignment applied successfully.\n\n" +
    "TEMP_ID values updated: " + updatedIds + "\n" +
    "RELATED_KEFG_ID values updated: " + updatedRelated + "\n" +
    "Missing mappings: " + missingMap + "\n\n" +
    "Mapping sheet created: " + mappingName
  );
}