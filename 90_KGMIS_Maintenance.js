/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Maintenance Utilities
 *
 * File:
 * 90_KGMIS_Maintenance.gs
 * ============================================================
 */


/**
 * ------------------------------------------------------------
 * Checks that all required KGMIS system sheets exist.
 * Safe to run at any time.
 * ------------------------------------------------------------
 */
function KGMIS_CheckSystemHealth() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const requiredSheets = [
    KGMIS_CONFIG.MASTER_SHEET,
    KGMIS_CONFIG.SYSTEM_SHEET,
    KGMIS_CONFIG.ACCESS_CONTROL_SHEET
  ];

  const missingSheets = [];

  requiredSheets.forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) {
      missingSheets.push(sheetName);
    }
  });

  if (missingSheets.length === 0) {

    SpreadsheetApp.getUi().alert(
      "KGMIS System Health Check\n\n" +
      "Status : PASSED ✅\n\n" +
      "All required KGMIS sheets are present."
    );

    return;
  }

  SpreadsheetApp.getUi().alert(
    "KGMIS System Health Check\n\n" +
    "Status : FAILED ❌\n\n" +
    "Missing Sheets:\n\n" +
    missingSheets.join("\n")
  );
}


/**
 * ------------------------------------------------------------
 * Displays basic information about the KGMIS installation.
 * Safe to run at any time.
 * ------------------------------------------------------------
 */
function KGMIS_ShowSystemInformation() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterSheet =
    ss.getSheetByName(KGMIS_CONFIG.MASTER_SHEET);

  const systemSheet =
    ss.getSheetByName(KGMIS_CONFIG.SYSTEM_SHEET);

  const accessSheet =
    ss.getSheetByName(KGMIS_CONFIG.ACCESS_CONTROL_SHEET);

  const totalMembers =
    masterSheet
      ? Math.max(
          0,
          masterSheet.getLastRow() -
          KGMIS_CONFIG.HEADER_ROW
        )
      : 0;

  let info = "";

  info += "KEF Global Membership Information System (KGMIS)\n\n";

  info += "Spreadsheet:\n";
  info += ss.getName() + "\n\n";

  info += "Master Sheet : ";
  info += masterSheet ? "Available" : "Missing";
  info += "\n";

  info += "System Sheet : ";
  info += systemSheet ? "Available" : "Missing";
  info += "\n";

  info += "Access Control Sheet : ";
  info += accessSheet ? "Available" : "Missing";
  info += "\n\n";

  info += "Member Records : ";
  info += totalMembers;

  SpreadsheetApp.getUi().alert(info);

}