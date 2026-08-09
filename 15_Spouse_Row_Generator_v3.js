function KEFG_Create_Rev02_With_Spouse_Rows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheetName = "KEFG_Test_Data_Rev_0.1";
  const targetSheetName = "KEFG_Test_Data_Rev_0.2";

  const sourceSheet = ss.getSheetByName(sourceSheetName);

  if (!sourceSheet) {
    throw new Error("Source sheet not found: " + sourceSheetName);
  }

  if (ss.getSheetByName(targetSheetName)) {
    SpreadsheetApp.getUi().alert(
      targetSheetName + " already exists.\n\nDelete or rename it before running again."
    );
    return;
  }

  const sheet = sourceSheet.copyTo(ss).setName(targetSheetName);
  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(sourceSheet.getIndex() + 1);

  const headerRow = 1;
  const firstDataRow = 2;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const headers = sheet.getRange(headerRow, 1, 1, lastCol).getDisplayValues()[0];

  function col(header) {
    const target = normalizeHeader(header);
    for (let i = 0; i < headers.length; i++) {
      if (normalizeHeader(headers[i]) === target) return i;
    }
    throw new Error('Header not found: "' + header + '"');
  }

  function normalizeHeader(value) {
    return String(value || "")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  const allowedAlumni = ["AECK", "CETA", "KEA", "MACE", "NIT", "NSS", "TEC", "TKMCE"];

  const C = {
    tempId: col("TEMP_ID"),
    memberName: col("Member_Name"),
    memberMobile: col("Member Mobile"),
    alumni: col("ALUMNI"),
    branch: col("Branch"),
    batch: col("YEAR/BATCH"),
    district: col("Current Location-District"),
    activities: col("Present Activities, or any other generic information"),
    memberBirthday: col("MEMBER BIRTHDAY (Date and Month)"),
    weddingDate: col("WEDDING DATE"),
    zone: col("ZONE"),
    sub2026: col("SUBSCRIPTION PAID (2026-2027)"),
    sub2025: col("SUBSCRIPTION PAID (2025-2026)"),
    whatsapp: col("WhatsApp Number"),
    profession: col("YOUR PROFESSION / SPECIALIZATION / EXPERTISE / SKILLS"),
    contributions: col("KEF / KEF Global Contributions (tick all applicable)"),
    volunteer: col("ARE YOU WILLING TO VOLUNTEER"),
    consent: col("Do you Agree the KEF Global maintaining this information for membership administration, directory publication and organizational communication"),
    category: col("MEMBER_CATEGORY"),
    relatedId: col("RELATED_KEFG_ID"),
    familyId: col("FAMILY_ID"),

    spouseName: col("Spouse - Name"),
    spouseMobile: col("Spouse - Mobile"),
    spouseAlumni: col("Spouse - Alumni"),
    spouseDistrict: col("Spouse - Current Location (District)"),
    spouseActivities: col("Spouse - Present Activities, or any other generic information"),
    spouseBirthday: col("SPOUSE BIRTHDAY (Date and Month)"),
    spouseBatch: col("SPOUSE'S YEAR/BATCH"),
    spouseProfession: col("SPOUSE'S PROFESSION / SPECIALIZATION / EXPERTISE / SKILLS"),
    spouseContributions: col("SPOUSE'S KEF / KEF Global Contributions (tick all applicable)"),
    spouseVolunteer: col("SPOUSE'S WILLINGNESS TO VOLUNTEER"),
    spouseBranch: col("SPOUSE'S BRANCH")
  };

  const data = sheet
    .getRange(firstDataRow, 1, lastRow - firstDataRow + 1, lastCol)
    .getValues();

  const output = [];

  let spouseRowsCreated = 0;
  let alumniSpouseCount = 0;
  let nonAlumniSpouseCount = 0;
  let blankSpouseSkipped = 0;
  let missingPrimaryIdSkipped = 0;

  data.forEach(row => {
    const primaryRow = row.slice();

    const primaryId = String(primaryRow[C.tempId] || "").trim();
    const spouseName = String(primaryRow[C.spouseName] || "").trim();

    if (primaryId && primaryRow[C.memberName]) {
      primaryRow[C.category] = "PRIMARY MEMBER";
    }

    output.push(primaryRow);

    if (!spouseName) {
      blankSpouseSkipped++;
      return;
    }

    if (!primaryId) {
      missingPrimaryIdSkipped++;
      return;
    }

    const spouseAlumniRaw = String(primaryRow[C.spouseAlumni] || "").trim().toUpperCase();

    const isAlumniSpouse = allowedAlumni.includes(spouseAlumniRaw);

    const spouseCategory = isAlumniSpouse
      ? "ALUMNI SPOUSE MEMBER"
      : "NON-ALUMNI SPOUSE";

    const spouseRow = new Array(lastCol).fill("");
    spouseRow[C.spouseAlumni] = "";

    spouseRow[C.tempId] = "";
    spouseRow[C.memberName] = primaryRow[C.spouseName];
    spouseRow[C.memberMobile] = primaryRow[C.spouseMobile];
    spouseRow[C.alumni] = isAlumniSpouse ? spouseAlumniRaw : "Not Applicable";
    spouseRow[C.district] = primaryRow[C.spouseDistrict];
    spouseRow[C.activities] = primaryRow[C.spouseActivities];
    spouseRow[C.memberBirthday] = primaryRow[C.spouseBirthday];
    spouseRow[C.weddingDate] = primaryRow[C.weddingDate];
    spouseRow[C.zone] = primaryRow[C.zone];
    spouseRow[C.sub2026] = primaryRow[C.sub2026];
    spouseRow[C.sub2025] = primaryRow[C.sub2025];
    spouseRow[C.whatsapp] = primaryRow[C.whatsapp];
    spouseRow[C.batch] = primaryRow[C.spouseBatch];
    spouseRow[C.profession] = primaryRow[C.spouseProfession];
    spouseRow[C.contributions] = primaryRow[C.spouseContributions];
    spouseRow[C.volunteer] = primaryRow[C.spouseVolunteer];
    spouseRow[C.branch] = primaryRow[C.spouseBranch];
    spouseRow[C.consent] = primaryRow[C.consent];

    spouseRow[C.category] = spouseCategory;
    spouseRow[C.relatedId] = primaryId;
    spouseRow[C.familyId] = "";

    output.push(spouseRow);

    spouseRowsCreated++;

    if (isAlumniSpouse) {
      alumniSpouseCount++;
    } else {
      nonAlumniSpouseCount++;
    }
  });

  sheet.getRange(firstDataRow, 1, sheet.getMaxRows() - firstDataRow + 1, lastCol)
  .clearDataValidations();
  sheet.getRange(firstDataRow, 1, output.length, lastCol).setValues(output);

  SpreadsheetApp.getUi().alert(
    "Rev 0.2 created successfully.\n\n" +
    "New sheet: " + targetSheetName + "\n\n" +
    "Spouse rows created: " + spouseRowsCreated + "\n" +
    "Alumni spouse members: " + alumniSpouseCount + "\n" +
    "Non-alumni spouses: " + nonAlumniSpouseCount + "\n" +
    "Blank spouse names skipped: " + blankSpouseSkipped + "\n" +
    "Missing primary TEMP_ID skipped: " + missingPrimaryIdSkipped + "\n\n" +
    "Next: run Assign Missing TEMP IDs on Rev 0.2."
  );
}