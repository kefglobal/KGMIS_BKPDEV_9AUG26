function KEFG_Create_All_Spouse_Person_Rows_SAFE() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("KEFG_Test_Data_Rev_0.1");

  const firstRow = 2;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const allowedAlumni = ["AECK", "CETA", "KEA", "MACE", "NIT", "NSS", "TEC", "TKMCE"];

  const col = {
    tempId: KEFG_getColumnByHeader_(sheet, "TEMP_ID"),
    memberName: KEFG_getColumnByHeader_(sheet, "Member_Name"),
    memberMobile: KEFG_getColumnByHeader_(sheet, "Member Mobile"),
    alumni: KEFG_getColumnByHeader_(sheet, "ALUMNI"),
    branch: KEFG_getColumnByHeader_(sheet, "Branch"),
    batch: KEFG_getColumnByHeader_(sheet, "YEAR/BATCH"),
    district: KEFG_getColumnByHeader_(sheet, "Current Location-District"),
    activities: KEFG_getColumnByHeader_(sheet, "Present Activities, or any other generic information"),
    memberBirthday: KEFG_getColumnByHeader_(sheet, "MEMBER BIRTHDAY (Date and Month)"),
    weddingDate: KEFG_getColumnByHeader_(sheet, "WEDDING DATE"),
    zone: KEFG_getColumnByHeader_(sheet, "ZONE"),
    sub2026: KEFG_getColumnByHeader_(sheet, "SUBSCRIPTION PAID (2026-2027)"),
    sub2025: KEFG_getColumnByHeader_(sheet, "SUBSCRIPTION PAID (2025-2026)"),
    whatsapp: KEFG_getColumnByHeader_(sheet, "WhatsApp Number"),
    profession: KEFG_getColumnByHeader_(sheet, "YOUR PROFESSION / SPECIALIZATION / EXPERTISE / SKILLS"),
    contributions: KEFG_getColumnByHeader_(sheet, "KEF / KEF Global Contributions (tick all applicable)"),
    volunteer: KEFG_getColumnByHeader_(sheet, "ARE YOU WILLING TO VOLUNTEER"),
    consent: KEFG_getColumnByHeader_(sheet, "Do you Agree the KEF Global maintaining this information for membership administration, directory publication and organizational communication"),
    category: KEFG_getColumnByHeader_(sheet, "MEMBER_CATEGORY"),
    relatedId: KEFG_getColumnByHeader_(sheet, "RELATED_KEFG_ID"),
    familyId: KEFG_getColumnByHeader_(sheet, "FAMILY_ID"),

    spouseName: KEFG_getColumnByHeader_(sheet, "Spouse - Name"),
    spouseMobile: KEFG_getColumnByHeader_(sheet, "Spouse - Mobile"),
    spouseAlumni: KEFG_getColumnByHeader_(sheet, "Spouse - Alumni"),
    spouseDistrict: KEFG_getColumnByHeader_(sheet, "Spouse - Current Location (District)"),
    spouseActivities: KEFG_getColumnByHeader_(sheet, "Spouse - Present Activities, or any other generic information"),
    spouseBirthday: KEFG_getColumnByHeader_(sheet, "SPOUSE BIRTHDAY (Date and Month)"),
    spouseBatch: KEFG_getColumnByHeader_(sheet, "SPOUSE'S YEAR/BATCH"),
    spouseProfession: KEFG_getColumnByHeader_(sheet, "SPOUSE'S PROFESSION / SPECIALIZATION / EXPERTISE / SKILLS"),
    spouseContributions: KEFG_getColumnByHeader_(sheet, "SPOUSE'S KEF / KEF Global Contributions (tick all applicable)"),
    spouseVolunteer: KEFG_getColumnByHeader_(sheet, "SPOUSE'S WILLINGNESS TO VOLUNTEER"),
    spouseBranch: KEFG_getColumnByHeader_(sheet, "SPOUSE'S BRANCH")
  };

  let inserted = 0;
  let alumniSpouse = 0;
  let nonAlumniSpouse = 0;
  let skippedBlank = 0;
  let skippedDuplicate = 0;

  for (let row = lastRow; row >= firstRow; row--) {
    const primaryId = String(sheet.getRange(row, col.tempId).getValue() || "").trim();
    const spouseName = String(sheet.getRange(row, col.spouseName).getValue() || "").trim();

    if (!spouseName) {
      skippedBlank++;
      continue;
    }

    if (KEFG_Spouse_Row_Already_Exists_SAFE_(sheet, primaryId, spouseName, col)) {
      skippedDuplicate++;
      continue;
    }

    const spouseAlumniRaw = String(sheet.getRange(row, col.spouseAlumni).getValue() || "").trim().toUpperCase();
    const isAlumniSpouse = allowedAlumni.includes(spouseAlumniRaw);

    const spouseCategory = isAlumniSpouse
      ? "ALUMNI SPOUSE MEMBER"
      : "NON-ALUMNI SPOUSE";

    const alumniValue = isAlumniSpouse ? spouseAlumniRaw : "Not Applicable";

    sheet.insertRowAfter(row);
    const newRow = row + 1;

    // Copy format and validation only
    sheet.getRange(row, 1, 1, lastCol)
      .copyTo(sheet.getRange(newRow, 1, 1, lastCol), { contentsOnly: false });

    sheet.getRange(newRow, 1, 1, lastCol).clearContent();

    // Mark original row
    sheet.getRange(row, col.category).setValue("PRIMARY MEMBER");

    // New spouse row
    sheet.getRange(newRow, col.tempId).clearContent();
    sheet.getRange(newRow, col.memberName).setValue(spouseName);
    sheet.getRange(newRow, col.memberMobile).setValue(sheet.getRange(row, col.spouseMobile).getValue());
    sheet.getRange(newRow, col.alumni).setValue(alumniValue);
    sheet.getRange(newRow, col.district).setValue(sheet.getRange(row, col.spouseDistrict).getValue());
    sheet.getRange(newRow, col.activities).setValue(sheet.getRange(row, col.spouseActivities).getValue());
    sheet.getRange(newRow, col.memberBirthday).setValue(sheet.getRange(row, col.spouseBirthday).getValue());
    sheet.getRange(newRow, col.weddingDate).setValue(sheet.getRange(row, col.weddingDate).getValue());
    sheet.getRange(newRow, col.zone).setValue(sheet.getRange(row, col.zone).getValue());
    sheet.getRange(newRow, col.sub2026).setValue(sheet.getRange(row, col.sub2026).getValue());
    sheet.getRange(newRow, col.sub2025).setValue(sheet.getRange(row, col.sub2025).getValue());
    sheet.getRange(newRow, col.whatsapp).setValue(sheet.getRange(row, col.whatsapp).getValue());
    sheet.getRange(newRow, col.batch).setValue(sheet.getRange(row, col.spouseBatch).getValue());
    sheet.getRange(newRow, col.profession).setValue(sheet.getRange(row, col.spouseProfession).getValue());
    sheet.getRange(newRow, col.contributions).setValue(sheet.getRange(row, col.spouseContributions).getValue());
    sheet.getRange(newRow, col.volunteer).setValue(sheet.getRange(row, col.spouseVolunteer).getValue());
    sheet.getRange(newRow, col.branch).setValue(sheet.getRange(row, col.spouseBranch).getValue());
    sheet.getRange(newRow, col.consent).setValue(sheet.getRange(row, col.consent).getValue());

    sheet.getRange(newRow, col.category).setValue(spouseCategory);
    sheet.getRange(newRow, col.relatedId).setValue(primaryId);
    sheet.getRange(newRow, col.familyId).clearContent();

    inserted++;

    if (isAlumniSpouse) alumniSpouse++;
    else nonAlumniSpouse++;
  }

  SpreadsheetApp.getUi().alert(
    "Spouse rows created safely.\n\n" +
    "Rows inserted: " + inserted + "\n" +
    "Alumni spouse members: " + alumniSpouse + "\n" +
    "Non-alumni spouses: " + nonAlumniSpouse + "\n" +
    "Blank spouse rows skipped: " + skippedBlank + "\n" +
    "Duplicate spouse rows skipped: " + skippedDuplicate + "\n\n" +
    "Next: KEFG Database → Assign Missing TEMP IDs"
  );
}

function KEFG_Spouse_Row_Already_Exists_SAFE_(sheet, primaryId, spouseName, col) {
  const firstRow = 2;
  const lastRow = sheet.getLastRow();

  if (lastRow < firstRow) return false;

  const names = sheet.getRange(firstRow, col.memberName, lastRow - firstRow + 1, 1).getValues();
  const relatedIds = sheet.getRange(firstRow, col.relatedId, lastRow - firstRow + 1, 1).getValues();

  const targetName = String(spouseName || "").trim().replace(/\s+/g, " ").toLowerCase();
  const targetId = String(primaryId || "").trim();

  for (let i = 0; i < names.length; i++) {
    const name = String(names[i][0] || "").trim().replace(/\s+/g, " ").toLowerCase();
    const relatedId = String(relatedIds[i][0] || "").trim();

    if (name === targetName && relatedId === targetId) {
      return true;
    }
  }

  return false;
}