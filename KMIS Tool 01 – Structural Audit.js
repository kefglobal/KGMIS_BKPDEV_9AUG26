function KMIS_Run_Structural_Audit() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const auditName = "KMIS_STRUCTURAL_AUDIT";

  const expectedHeaders = [
    "TEMP_ID","FAMILY_ID","RELATED_KEFG_ID","MEMBER_CATEGORY","RECORD_STATUS",
    "MEMBER_NAME","PHOTO","GENDER","BLOOD_GROUP","ALUMNI_ASSOCIATION","BRANCH","YEAR_BATCH",
    "TYPE_OF_MEMBERSHIP","SUBSCRIPTION_STATUS_2026_2027","SUBSCRIPTION_STATUS_2025_2026","SUBSCRIPTION_STATUS_2024_2025",
    "MEMBER_MOBILE","MEMBER_WHATSAPP","MEMBER_EMAIL","WHATSAPP_GROUP_MEMBER",
    "CURRENT_LOCATION_COUNTRY","CURRENT_LOCATION_STATE","CURRENT_LOCATION_CITY_DISTRICT","LATEST_ADDRESS","HOME_LOCATION_GOOGLE_MAP","ZONE",
    "MEMBER_PRESENT_ACTIVITIES","MEMBER_PROFESSION_SKILLS","KEF_KEFGLOBAL_CONTRIBUTIONS","MEMBER_WILLING_TO_VOLUNTEER","REMARKS",
    "SPOUSE_NAME","SPOUSE_MOBILE","SPOUSE_ALUMNI_ASSOCIATION","SPOUSE_BATCH_YEAR","SPOUSE_CURRENT_CITY_DISTRICT","SPOUSE_ACTIVITIES",
    "SPOUSE_PROFESSION_SKILLS","SPOUSE_KEF_KEFGLOBAL_CONTRIBUTIONS","SPOUSE_WILLING_TO_VOLUNTEER",
    "CHILD_1_NAME_AND_PROFESSION","CHILD_2_NAME_AND_PROFESSION","CHILD_3_NAME_AND_PROFESSION",
    "MEMBER_BIRTHDAY_DATE_AND_MONTH","MEMBER_DOB_FULL","SPOUSE_BIRTHDAY_DATE_AND_MONTH","SPOUSE_DOB_FULL","WEDDING_DATE","WEDDING_DATE_FULL",
    "DATA_CONSENT","UPDATE_SPOUSE_DATA","WILLING_TO_JOIN","LEGACY_SUBSCRIPTION_REMARKS"
  ];

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found: " + masterName);

  let audit = ss.getSheetByName(auditName);
  if (audit) audit.clear();
  else audit = ss.insertSheet(auditName);

  const actualHeaders = master
    .getRange(1, 1, 1, master.getLastColumn())
    .getDisplayValues()[0]
    .map(h => String(h || "").trim());

  const maxLen = Math.max(expectedHeaders.length, actualHeaders.length);

  const output = [
  ["KMIS STRUCTURAL AUDIT", "", "", "", ""],
  ["Master Sheet", masterName, "", "", ""],
  ["Generated On", new Date(), "", "", ""],
  ["Expected Columns", expectedHeaders.length, "", "", ""],
  ["Actual Columns", actualHeaders.filter(h => h !== "").length, "", "", ""],
  ["", "", "", "", ""],
  ["STATUS", "COLUMN", "EXPECTED HEADER", "ACTUAL HEADER", "REMARK"]
];

  let pass = true;

  for (let i = 0; i < maxLen; i++) {
    const expected = expectedHeaders[i] || "";
    const actual = actualHeaders[i] || "";

    let status = "PASS";
    let remark = "";

    if (expected !== actual) {
      pass = false;
      status = "FAIL";

      if (!expected && actual) remark = "Extra column in sheet";
      else if (expected && !actual) remark = "Missing column in sheet";
      else remark = "Header mismatch or wrong order";
    }

    output.push([
      status,
      i + 1,
      expected,
      actual,
      remark
    ]);
  }

  audit.getRange(1, 1, output.length, 5).setValues(output);
  audit.setFrozenRows(7);
  audit.autoResizeColumns(1, 5);

  SpreadsheetApp.getUi().alert(
    pass
      ? "Structural Audit PASSED.\n\nMaster database matches frozen schema."
      : "Structural Audit FAILED.\n\nCheck sheet: " + auditName
  );
}