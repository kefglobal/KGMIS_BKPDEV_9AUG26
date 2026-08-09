function myFunction() {
  function KEFG_Create_Master_Database_v1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sourceName = "KEFG_Test_Data_Rev_0.3";
  const targetName = "KEFG_MASTER_DATABASE_v1.0";

  const source = ss.getSheetByName(sourceName);
  if (!source) throw new Error("Source sheet not found: " + sourceName);

  if (ss.getSheetByName(targetName)) {
    SpreadsheetApp.getUi().alert(
      targetName + " already exists. Delete or rename it before running again."
    );
    return;
  }

  const finalHeaders = [
    "TEMP_ID",
    "FAMILY_ID",
    "RELATED_KEFG_ID",
    "MEMBER_CATEGORY",
    "Member_Name",
    "ALUMNI",
    "Branch",
    "YEAR/BATCH",
    "Member Mobile",
    "WhatsApp Number",
    "Member Email",
    "Photo",
    "Type of Membership",
    "SUBSCRIPTION STATUS (2026-2027)",
    "SUBSCRIPTION PAID (2026-2027)",
    "SUBSCRIPTION PAID (2025-2026)",
    "Current Location- Country",
    "Current Location-State",
    "Current Location-District",
    "Latest Address",
    "Home Location in Google Map",
    "MEMBER BIRTHDAY (Date and Month)",
    "MEMBER_DOB_FULL",
    "SPOUSE BIRTHDAY (Date and Month)",
    "SPOUSE_DOB_FULL",
    "WEDDING DATE",
    "WEDDING_DATE_FULL",
    "ZONE",
    "Present Activities, or any other generic information",
    "YOUR PROFESSION / SPECIALIZATION / EXPERTISE / SKILLS",
    "KEF / KEF Global Contributions (tick all applicable)",
    "ARE YOU WILLING TO VOLUNTEER",
    "REMARKS"
  ];

  const sourceHeaders = source
    .getRange(1, 1, 1, source.getLastColumn())
    .getDisplayValues()[0];

  const sourceData = source
    .getRange(2, 1, source.getLastRow() - 1, source.getLastColumn())
    .getValues();

  const target = ss.insertSheet(targetName);

  target.getRange(1, 1, 1, finalHeaders.length).setValues([finalHeaders]);

  const output = sourceData.map(row => {
    return finalHeaders.map(header => {
      const index = findHeaderIndex_(sourceHeaders, header);
      return index === -1 ? "" : row[index];
    });
  });

  if (output.length > 0) {
    target.getRange(2, 1, output.length, finalHeaders.length).setValues(output);
  }

  target.setFrozenRows(1);
  target.autoResizeColumns(1, finalHeaders.length);

  SpreadsheetApp.getUi().alert(
    "Master database created successfully.\n\n" +
    "Source: " + sourceName + "\n" +
    "New sheet: " + targetName + "\n" +
    "Rows copied: " + output.length
  );
}

function findHeaderIndex_(headers, headerName) {
  const target = normalizeHeaderForMaster_(headerName);

  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeaderForMaster_(headers[i]) === target) {
      return i;
    }
  }

  return -1;
}

function normalizeHeaderForMaster_(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
}
