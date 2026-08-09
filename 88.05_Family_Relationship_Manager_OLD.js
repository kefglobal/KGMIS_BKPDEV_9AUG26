function KEFG_Generate_Family_IDs_And_Relationships() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("KEFG_Test_Data_Rev_0.1");

  const FIRST_DATA_ROW = 2;

  const tempIdCol = KEFG_getColumnByHeader_(sheet, "TEMP_ID");
  const memberNameCol = KEFG_getColumnByHeader_(sheet, "Member_Name");
  const spouseNameCol = KEFG_getColumnByHeader_(sheet, "Spouse - Name");
  const categoryCol = KEFG_getColumnByHeader_(sheet, "MEMBER_CATEGORY");
  const relatedCol = KEFG_getColumnByHeader_(sheet, "RELATED_KEFG_ID");
  const familyCol = KEFG_getColumnByHeader_(sheet, "FAMILY_ID");

  const lastRow = sheet.getLastRow();
  if (lastRow < FIRST_DATA_ROW) return;

  const numRows = lastRow - FIRST_DATA_ROW + 1;

  const tempIds = sheet.getRange(FIRST_DATA_ROW, tempIdCol, numRows, 1).getValues();
  const memberNames = sheet.getRange(FIRST_DATA_ROW, memberNameCol, numRows, 1).getValues();
  const spouseNames = sheet.getRange(FIRST_DATA_ROW, spouseNameCol, numRows, 1).getValues();
  const categories = sheet.getRange(FIRST_DATA_ROW, categoryCol, numRows, 1).getValues();
  const relatedIds = sheet.getRange(FIRST_DATA_ROW, relatedCol, numRows, 1).getValues();
  const familyIds = sheet.getRange(FIRST_DATA_ROW, familyCol, numRows, 1).getValues();

  const spouseKeyToRow = {};

  // Build lookup for spouse rows already created
  for (let i = 0; i < numRows; i++) {
    const name = normalizeFamilyName_(memberNames[i][0]);
    const category = String(categories[i][0] || "").trim();

    if (
      name !== "" &&
      (category === "ALUMNI SPOUSE MEMBER" || category === "NON-ALUMNI SPOUSE")
    ) {
      spouseKeyToRow[name] = i;
    }
  }

  let familyUpdated = 0;
  let relationshipsUpdated = 0;

  for (let i = 0; i < numRows; i++) {
    const primaryId = String(tempIds[i][0] || "").trim();
    const memberName = String(memberNames[i][0] || "").trim();
    const spouseName = String(spouseNames[i][0] || "").trim();
    const category = String(categories[i][0] || "").trim();

    if (primaryId === "" || memberName === "") continue;

    if (category === "" || category === "PRIMARY MEMBER") {
      categories[i][0] = "PRIMARY MEMBER";

      const familyId = makeFamilyIdFromTempId_(primaryId);
      familyIds[i][0] = familyId;
      familyUpdated++;

      if (spouseName !== "") {
        const spouseKey = normalizeFamilyName_(spouseName);
        const spouseRowIndex = spouseKeyToRow[spouseKey];

        if (spouseRowIndex !== undefined) {
          const spouseId = String(tempIds[spouseRowIndex][0] || "").trim();

          if (spouseId !== "") {
            relatedIds[i][0] = spouseId;
            relatedIds[spouseRowIndex][0] = primaryId;

            familyIds[spouseRowIndex][0] = familyId;

            relationshipsUpdated++;
          }
        }
      }
    }
  }

  sheet.getRange(FIRST_DATA_ROW, categoryCol, numRows, 1).setValues(categories);
  sheet.getRange(FIRST_DATA_ROW, relatedCol, numRows, 1).setValues(relatedIds);
  sheet.getRange(FIRST_DATA_ROW, familyCol, numRows, 1).setValues(familyIds);

  SpreadsheetApp.getUi().alert(
    "Family and relationship update completed.\n\n" +
    "Family IDs updated: " + familyUpdated + "\n" +
    "Relationships linked: " + relationshipsUpdated
  );
}

function makeFamilyIdFromTempId_(tempId) {
  const match = String(tempId || "").trim().match(/^TEMP_(\d+)$/);

  if (!match) return "";

  return "FAM_" + match[1];
}

function normalizeFamilyName_(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}