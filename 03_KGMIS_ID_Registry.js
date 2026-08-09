/**
 * Rebuilds the permanent KEFG ID registry
 * inside the KGMIS_SYSTEM sheet.
 * File Name: 03_KGMIS_ID_Registry.gs
 */
function KGMIS_BuildIdRegistry() {
  const sheet = KGMIS_getMainSheet_();
  const systemSheet = KGMIS_getSystemSheet_();

  const idCol = KGMIS_getColumnByHeader_(
    sheet,
    KGMIS_CONFIG.ID_HEADER
  );

  const nameCol = KGMIS_getColumnByHeader_(
    sheet,
    KGMIS_CONFIG.NAME_HEADER
  );

  const lastRow = sheet.getLastRow();

  const output = [
    ['KEFG_ID', 'MEMBER_NAME', 'UPDATED_ON']
  ];

  if (lastRow >= KGMIS_CONFIG.FIRST_DATA_ROW) {
    const numRows =
      lastRow - KGMIS_CONFIG.FIRST_DATA_ROW + 1;

    const ids = sheet
      .getRange(
        KGMIS_CONFIG.FIRST_DATA_ROW,
        idCol,
        numRows,
        1
      )
      .getDisplayValues();

    const names = sheet
      .getRange(
        KGMIS_CONFIG.FIRST_DATA_ROW,
        nameCol,
        numRows,
        1
      )
      .getDisplayValues();

    const updatedOn = new Date();

    for (let index = 0; index < numRows; index++) {
      const id = String(ids[index][0] || '')
        .trim()
        .toUpperCase();

      const name = String(names[index][0] || '')
        .trim();

      /*
       * Include only valid permanent KEFG IDs.
       */
      if (/^KEFG\d{4,}$/.test(id)) {
        output.push([
          id,
          name,
          updatedOn
        ]);
      }
    }
  }

  /*
   * Registry occupies Columns D:F of KGMIS_SYSTEM.
   */
  systemSheet
    .getRange(
      1,
      4,
      systemSheet.getMaxRows(),
      3
    )
    .clearContent();

  systemSheet
    .getRange(
      1,
      4,
      output.length,
      3
    )
    .setValues(output);

  /*
   * Format the UPDATED_ON column.
   */
  if (output.length > 1) {
    systemSheet
      .getRange(
        2,
        6,
        output.length - 1,
        1
      )
      .setNumberFormat(
        'dd-MMM-yyyy HH:mm:ss'
      );
  }

  systemSheet.hideSheet();

  SpreadsheetApp.flush();

  SpreadsheetApp.getActive().toast(
    `${output.length - 1} KEFG IDs registered in KGMIS_SYSTEM.`,
    'KGMIS ID Registry',
    5
  );
}