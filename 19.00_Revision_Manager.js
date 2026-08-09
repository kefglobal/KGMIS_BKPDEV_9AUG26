function KEFG_Create_New_Revision(purpose) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const prefix = "KEFG_Test_Data_Rev_0.";

  const sheets = ss.getSheets();
  let latestNumber = 0;
  let latestSheet = null;

  sheets.forEach(sheet => {
    const name = sheet.getName();
    const match = name.match(/^KEFG_Test_Data_Rev_0\.(\d+)$/);

    if (match) {
      const num = Number(match[1]);
      if (num > latestNumber) {
        latestNumber = num;
        latestSheet = sheet;
      }
    }
  });

  if (!latestSheet) {
    throw new Error("No KEFG revision sheet found.");
  }

  const newNumber = latestNumber + 1;
  const newName = prefix + newNumber;

  if (ss.getSheetByName(newName)) {
    throw new Error("Revision already exists: " + newName);
  }

  const newSheet = latestSheet.copyTo(ss).setName(newName);

  ss.setActiveSheet(newSheet);
  ss.moveActiveSheet(latestSheet.getIndex() + 1);

  KEFG_Add_Revision_Metadata_(newSheet, latestSheet.getName(), newName, purpose);

  SpreadsheetApp.getUi().alert(
    "New revision created successfully.\n\n" +
    "From: " + latestSheet.getName() + "\n" +
    "To: " + newName + "\n" +
    "Purpose: " + (purpose || "Not specified")
  );

  return newSheet;
}

function KEFG_Add_Revision_Metadata_(sheet, parentName, newName, purpose) {
  const metadata = [
    ["REVISION_NAME", newName],
    ["PARENT_REVISION", parentName],
    ["PURPOSE", purpose || "Not specified"],
    ["CREATED_ON", new Date()],
    ["CREATED_BY", "KEFG Member Database Manager"]
  ];

  const startCol = sheet.getLastColumn() + 2;

  sheet.getRange(1, startCol, metadata.length, 2).setValues(metadata);
  sheet.hideColumns(startCol, 2);
}

function KEFG_Create_Rev03_For_Date_Cleanup() {
  KEFG_Create_New_Revision("Date Cleanup");
}