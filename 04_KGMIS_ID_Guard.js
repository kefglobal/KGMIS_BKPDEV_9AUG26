/**
 * Protects permanent KEFG_ID values from manual editing or deletion.
 * File Name: 04_KGMIS_ID_Guard.gs
 * Attach this function to an installable "On edit" trigger.
 */
function KGMIS_GuardMemberIdEdit(e) {
  if (!e || !e.range) {
    return;
  }

  const range = e.range;
  const sheet = range.getSheet();

  if (
    sheet.getName() !==
    KGMIS_CONFIG.MASTER_SHEET
  ) {
    return;
  }

  const idColumn = KGMIS_getColumnByHeader_(
    sheet,
    KGMIS_CONFIG.ID_HEADER
  );

  const firstEditedColumn = range.getColumn();
  const lastEditedColumn =
    range.getLastColumn();

  /*
   * Stop if the edited range does not include
   * the KEFG_ID column.
   */
  if (
    idColumn < firstEditedColumn ||
    idColumn > lastEditedColumn
  ) {
    return;
  }

  const firstEditedRow = range.getRow();
  const lastEditedRow = range.getLastRow();

  if (
    lastEditedRow <
    KGMIS_CONFIG.FIRST_DATA_ROW
  ) {
    return;
  }

  /*
   * Single-cell editing can be restored using e.oldValue.
   */
  if (
    range.getNumRows() === 1 &&
    range.getNumColumns() === 1
  ) {
    const editedValue = String(
      range.getValue() ?? ''
    ).trim();

    const oldValue = String(
      e.oldValue ?? ''
    ).trim();

    /*
     * Prevent changing or deleting an existing KEFG_ID.
     */
    if (oldValue) {
      range.setValue(oldValue);

      SpreadsheetApp.getActive().toast(
        `KEFG_ID is protected. Original ID restored: ${oldValue}`,
        'KGMIS ID Guard',
        8
      );

      return;
    }

    /*
     * Prevent manually entering an ID into a blank cell.
     */
    if (editedValue) {
      range.clearContent();

      SpreadsheetApp.getActive().toast(
        'KEFG_ID cannot be entered manually. Use the KGMIS ID Manager.',
        'KGMIS ID Guard',
        8
      );
    }

    return;
  }

  /*
   * The edit included multiple cells.
   * An edit event does not provide all previous values,
   * so the trigger cannot safely reconstruct them.
   */
  SpreadsheetApp.getActive().toast(
    'A multi-cell edit included the protected KEFG_ID column. Please undo the edit immediately.',
    'KGMIS ID Guard Warning',
    10
  );
}