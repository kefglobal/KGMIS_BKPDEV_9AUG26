/**
 * KEF Global Membership Information System (KGMIS)
 * Custom Menu and Spreadsheet Triggers
 * File Name: 05_KGMIS_Menu_And_Triggers
 */


/**
 * Creates the KGMIS menu whenever the spreadsheet is opened.
 */
function onOpen(e) {
  SpreadsheetApp.getUi()
    .createMenu('KGMIS Database')

    .addItem(
      'Assign Missing KEFG IDs',
      'KGMIS_AssignMissingMemberIds'
    )

    .addItem(
      'Build / Refresh ID Registry',
      'KGMIS_BuildIdRegistry'
    )

    .addSeparator()

    .addItem(
      'Run ID System Setup',
      'KGMIS_RunIdSystemSetup'
    )

    .addSeparator()

    .addItem(
      'Check System Health',
      'KGMIS_CheckSystemHealth'
    )

    .addToUi();
}


/**
 * Assigns missing permanent KEFG IDs and
 * rebuilds the ID registry.
 */
function KGMIS_RunIdSystemSetup() {
  const ui = SpreadsheetApp.getUi();

  try {
    KGMIS_AssignMissingMemberIds();
    KGMIS_BuildIdRegistry();

    ui.alert(
      'KGMIS ID System Setup Completed\n\n' +
      'Missing KEFG IDs were assigned and the ' +
      'KGMIS_SYSTEM ID registry was refreshed.'
    );

  } catch (error) {
    console.error(
      'KGMIS ID system setup failed:',
      error
    );

    ui.alert(
      'KGMIS ID System Setup Failed\n\n' +
      String(error.message || error)
    );
  }
}


/**
 * Runs automatically whenever a user edits the spreadsheet.
 *
 * Actions:
 * 1. Protects permanent KEFG_ID values.
 * 2. Detects changes to the MEMBER_NAME column.
 * 3. Assigns missing KEFG IDs.
 * 4. Refreshes the ID registry.
 */
function onEdit(e) {
  if (!e || !e.range) {
    return;
  }

  /*
   * Protect the KEFG_ID column.
   */
  KGMIS_GuardMemberIdEdit(e);

  const range = e.range;
  const sheet = range.getSheet();

  /*
   * Process edits only in the master database sheet.
   */
  if (
    sheet.getName() !==
    KGMIS_CONFIG.MASTER_SHEET
  ) {
    return;
  }

  /*
   * Ignore edits above the first data row.
   */
  if (
    range.getLastRow() <
    KGMIS_CONFIG.FIRST_DATA_ROW
  ) {
    return;
  }

  const nameColumn =
    KGMIS_getColumnByHeader_(
      sheet,
      KGMIS_CONFIG.NAME_HEADER
    );

  const firstEditedColumn =
    range.getColumn();

  const lastEditedColumn =
    range.getLastColumn();

  /*
   * Continue only when the edited range includes
   * the MEMBER_NAME column.
   */
  if (
    nameColumn < firstEditedColumn ||
    nameColumn > lastEditedColumn
  ) {
    return;
  }

  try {
    KGMIS_AssignMissingMemberIds();
    KGMIS_BuildIdRegistry();

  } catch (error) {
    console.error(
      'Automatic KGMIS ID processing failed:',
      error
    );

    SpreadsheetApp
      .getActiveSpreadsheet()
      .toast(
        String(error.message || error),
        'KGMIS ID Processing Error',
        10
      );
  }
}