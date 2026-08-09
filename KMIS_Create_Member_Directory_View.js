function KMIS_Create_Member_Directory_View() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const directoryName = "KMIS_MEMBER_DIRECTORY_VIEW";

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found: " + masterName);

  const oldDir = ss.getSheetByName(directoryName);
  if (oldDir) ss.deleteSheet(oldDir);

  const dir = ss.insertSheet(directoryName);

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();

  const headers = master.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  function col(h) {
    const i = headers.indexOf(h);
    if (i === -1) throw new Error("Header not found: " + h);
    return i;
  }

  const C = {
    KEFG_ID: col("KEFG_ID"),
    FAMILY_ID: col("FAMILY_ID"),
    MEMBER_CATEGORY: col("MEMBER_CATEGORY"),
    RECORD_STATUS: col("RECORD_STATUS"),
    MEMBER_NAME: col("MEMBER_NAME"),
    ALUMNI_ASSOCIATION: col("ALUMNI_ASSOCIATION"),
    BRANCH: col("BRANCH"),
    YEAR_BATCH: col("YEAR_BATCH"),
    MEMBER_MOBILE: col("MEMBER_MOBILE"),
    MEMBER_WHATSAPP: col("MEMBER_WHATSAPP"),
    MEMBER_EMAIL: col("MEMBER_EMAIL"),
    CURRENT_LOCATION_COUNTRY: col("CURRENT_LOCATION_COUNTRY"),
    CURRENT_LOCATION_STATE: col("CURRENT_LOCATION_STATE"),
    CURRENT_LOCATION_CITY_DISTRICT: col("CURRENT_LOCATION_CITY_DISTRICT"),
    ZONE: col("ZONE"),
    MEMBER_PROFESSION_SKILLS: col("MEMBER_PROFESSION_SKILLS")
  };

  const data = lastRow > 1
    ? master.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues()
    : [];

  const output = [[
    "KEFG_ID",
    "FAMILY_ID",
    "MEMBER_NAME",
    "MEMBER_CATEGORY",
    "ALUMNI_ASSOCIATION",
    "BRANCH",
    "YEAR_BATCH",
    "MEMBER_MOBILE",
    "MEMBER_WHATSAPP",
    "MEMBER_EMAIL",
    "COUNTRY",
    "STATE",
    "CITY_DISTRICT",
    "ZONE",
    "PROFESSION_SKILLS"
  ]];

  data.forEach(row => {
    const status = String(row[C.RECORD_STATUS] || "").trim().toUpperCase();

    // Include blank status also, because many current rows may not yet have ACTIVE
    if (status && status !== "ACTIVE") return;

    output.push([
      row[C.KEFG_ID],
      row[C.FAMILY_ID],
      row[C.MEMBER_NAME],
      row[C.MEMBER_CATEGORY],
      row[C.ALUMNI_ASSOCIATION],
      row[C.BRANCH],
      row[C.YEAR_BATCH],
      row[C.MEMBER_MOBILE],
      row[C.MEMBER_WHATSAPP],
      row[C.MEMBER_EMAIL],
      row[C.CURRENT_LOCATION_COUNTRY],
      row[C.CURRENT_LOCATION_STATE],
      row[C.CURRENT_LOCATION_CITY_DISTRICT],
      row[C.ZONE],
      row[C.MEMBER_PROFESSION_SKILLS]
    ]);
  });

  output.splice(1, output.length - 1, ...output.slice(1).sort((a, b) =>
    String(a[2] || "").localeCompare(String(b[2] || ""))
  ));

  dir.getRange(1, 1, output.length, output[0].length).setValues(output);
  dir.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Member Directory View created.\n\n" +
    "Rows listed: " + (output.length - 1) + "\n\n" +
    "Sheet: " + directoryName
  );
}