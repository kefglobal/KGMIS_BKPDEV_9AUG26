/**
 * Assigns permanent KEFG IDs to records where KEFG_ID is blank.
 * File Name: 02_KGMIS_ID_Manager.gs
 * Example IDs:
 * KEFG1001
 * KEFG1002
 */
function KGMIS_AssignMissingMemberIds() {
  const sheet = KGMIS_getMainSheet_();

  const idCol = KGMIS_getColumnByHeader_(
    sheet,
    KGMIS_CONFIG.ID_HEADER
  );

  const nameCol = KGMIS_getColumnByHeader_(
    sheet,
    KGMIS_CONFIG.NAME_HEADER
  );

  const lastRow = sheet.getLastRow();

  if (lastRow < KGMIS_CONFIG.FIRST_DATA_ROW) {
    return;
  }

  const numRows =
    lastRow - KGMIS_CONFIG.FIRST_DATA_ROW + 1;

  const idRange = sheet.getRange(
    KGMIS_CONFIG.FIRST_DATA_ROW,
    idCol,
    numRows,
    1
  );

  const nameRange = sheet.getRange(
    KGMIS_CONFIG.FIRST_DATA_ROW,
    nameCol,
    numRows,
    1
  );

  const ids = idRange.getDisplayValues();
  const names = nameRange.getDisplayValues();

  let highestExistingNumber =
    KGMIS_CONFIG.ID_START_NUMBER - 1;

  /*
   * Find the highest existing permanent KEFG ID.
   */
  ids.forEach(row => {
    const id = String(row[0] || '')
      .trim()
      .toUpperCase();

    const match = id.match(/^KEFG(\d+)$/);

    if (match) {
      highestExistingNumber = Math.max(
        highestExistingNumber,
        Number(match[1])
      );
    }
  });

  /*
   * Compare the IDs in the database with the last
   * number recorded in KGMIS_SYSTEM.
   */
  let nextIdNumber = Math.max(
    KGMIS_getLastIssuedId_(),
    highestExistingNumber
  );

  let newIdsAssigned = 0;

  for (let index = 0; index < numRows; index++) {
    const name = String(names[index][0] || '')
      .trim();

    const existingId = String(ids[index][0] || '')
      .trim();

    if (name && !existingId) {
      nextIdNumber++;

      ids[index][0] =
        KGMIS_formatMemberId_(nextIdNumber);

      newIdsAssigned++;
    }
  }

  if (newIdsAssigned > 0) {
    idRange.setValues(ids);
    KGMIS_setLastIssuedId_(nextIdNumber);
    SpreadsheetApp.flush();
  }

  SpreadsheetApp.getActive().toast(
    `${newIdsAssigned} new KEFG IDs assigned.`,
    'KGMIS ID Manager',
    5
  );
}