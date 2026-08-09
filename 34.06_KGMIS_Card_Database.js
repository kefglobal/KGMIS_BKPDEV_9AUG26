/**
 * ============================================================
 * 34.06_KGMIS_Card_Database.gs
 * ============================================================
 *
 * PART 4D – DIGITAL CARD DATABASE WRITE ENGINE
 *
 * Target sheet:
 * KEFG_MEMBER_CARDS
 *
 * Functions:
 *
 * 4D.1  KGMIS_CardObjectToRow_()
 * 4D.2  KGMIS_InsertCardRecord_()
 * 4D.3  KGMIS_UpdateCardRecord_()
 * 4D.4  KGMIS_SaveCardRecord_()
 * 4D.5  KGMIS_TestSaveCardRecord()
 *
 * Save policy:
 *
 * - CARD_ID is the unique record key.
 * - If CARD_ID does not exist, insert a new row.
 * - If CARD_ID exists, update the complete card row.
 *
 * Fields preserved during update:
 *
 * - CARD_ID
 * - QR_TOKEN
 * - ISSUE_DATE
 * - CREATED_ON
 * - CREATED_BY
 *
 * The column order is read directly from Row 1 of
 * KEFG_MEMBER_CARDS.
 *
 * ============================================================
 */


/**
 * ============================================================
 * 4D.1 – CONVERT CARD OBJECT TO SHEET ROW
 * ============================================================
 *
 * Converts a card object into an array based on the exact
 * header order supplied from KEFG_MEMBER_CARDS.
 *
 * @param {Object} cardRecord
 * @param {string[]} headers
 * @return {Array}
 */

function KGMIS_CardObjectToRow_(cardRecord, headers) {

  if (
    !cardRecord ||
    typeof cardRecord !== "object" ||
    Array.isArray(cardRecord)
  ) {

    throw new Error(
      "A valid Card Record object is required."
    );

  }

  if (
    !Array.isArray(headers) ||
    headers.length === 0
  ) {

    throw new Error(
      "Card Registry headers are required."
    );

  }

  return headers.map(function(header) {

    const value =
      cardRecord[header];

    if (
      value === undefined ||
      value === null
    ) {

      return "";

    }

    return value;

  });

}


/**
 * ============================================================
 * 4D.2 – INSERT NEW CARD RECORD
 * ============================================================
 *
 * Inserts one new Card Record into KEFG_MEMBER_CARDS.
 *
 * This function assumes that duplicate checking has already
 * been completed by KGMIS_SaveCardRecord_().
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string[]} headers
 * @param {Object} cardRecord
 * @return {Object}
 */

function KGMIS_InsertCardRecord_(
  sheet,
  headers,
  cardRecord
) {

  const now =
    new Date();

  const activeUserEmail =
    Session
      .getActiveUser()
      .getEmail();

  const effectiveUserEmail =
    Session
      .getEffectiveUser()
      .getEmail();

  const userEmail =
    activeUserEmail ||
    effectiveUserEmail ||
    "SYSTEM";

  const insertRecord =
    Object.assign(
      {},
      cardRecord
    );

  /*
   * Complete missing audit values.
   */

  if (!insertRecord.ISSUE_DATE) {

    insertRecord.ISSUE_DATE =
      now;

  }

  if (!insertRecord.CREATED_ON) {

    insertRecord.CREATED_ON =
      now;

  }

  if (!insertRecord.CREATED_BY) {

    insertRecord.CREATED_BY =
      userEmail;

  }

  /*
   * New records do not initially have update audit values.
   */

  insertRecord.UPDATED_ON =
    "";

  insertRecord.UPDATED_BY =
    "";

  const rowValues =
    KGMIS_CardObjectToRow_(
      insertRecord,
      headers
    );

  const targetRow =
    sheet.getLastRow() + 1;

  sheet
    .getRange(
      targetRow,
      1,
      1,
      rowValues.length
    )
    .setValues([
      rowValues
    ]);

  return {

    action:
      "INSERTED",

    rowNumber:
      targetRow,

    cardId:
      insertRecord.CARD_ID,

    cardRecord:
      insertRecord

  };

}


/**
 * ============================================================
 * 4D.3 – UPDATE EXISTING CARD RECORD
 * ============================================================
 *
 * Updates the complete card row.
 *
 * The following permanent fields are retained from the
 * existing registry record:
 *
 * - CARD_ID
 * - QR_TOKEN
 * - ISSUE_DATE
 * - CREATED_ON
 * - CREATED_BY
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {string[]} headers
 * @param {number} rowNumber
 * @param {Object} cardRecord
 * @return {Object}
 */

function KGMIS_UpdateCardRecord_(
  sheet,
  headers,
  rowNumber,
  cardRecord
) {

  if (
    !rowNumber ||
    rowNumber < 2
  ) {

    throw new Error(
      "A valid Card Registry row number is required."
    );

  }

  const existingValues =
    sheet
      .getRange(
        rowNumber,
        1,
        1,
        headers.length
      )
      .getValues()[0];

  const existingRecord =
    {};

  headers.forEach(function(header, index) {

    existingRecord[header] =
      existingValues[index];

  });

  /*
   * Option A:
   *
   * Start with the existing record and overwrite it with the
   * complete current Card Record object.
   */

  const updatedRecord =
    Object.assign(
      {},
      existingRecord,
      cardRecord
    );

  /*
   * Preserve permanent card identity and original audit data.
   */

  updatedRecord.CARD_ID =
    existingRecord.CARD_ID;

  updatedRecord.QR_TOKEN =
    existingRecord.QR_TOKEN ||
    cardRecord.QR_TOKEN;

  updatedRecord.ISSUE_DATE =
    existingRecord.ISSUE_DATE ||
    cardRecord.ISSUE_DATE ||
    new Date();

  updatedRecord.CREATED_ON =
    existingRecord.CREATED_ON ||
    cardRecord.CREATED_ON ||
    new Date();

  updatedRecord.CREATED_BY =
    existingRecord.CREATED_BY ||
    cardRecord.CREATED_BY ||
    Session
      .getEffectiveUser()
      .getEmail() ||
    "SYSTEM";

  /*
   * Record the current update.
   */

  updatedRecord.UPDATED_ON =
    new Date();

  updatedRecord.UPDATED_BY =
    Session
      .getActiveUser()
      .getEmail() ||
    Session
      .getEffectiveUser()
      .getEmail() ||
    "SYSTEM";

  const rowValues =
    KGMIS_CardObjectToRow_(
      updatedRecord,
      headers
    );

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      rowValues.length
    )
    .setValues([
      rowValues
    ]);

  return {

    action:
      "UPDATED",

    rowNumber:
      rowNumber,

    cardId:
      updatedRecord.CARD_ID,

    cardRecord:
      updatedRecord

  };

}


/**
 * ============================================================
 * 4D.4 – SMART SAVE CARD RECORD
 * ============================================================
 *
 * Main database function used by the Card Generator.
 *
 * Process:
 *
 * 1. Validate the Card Record.
 * 2. Read KEFG_MEMBER_CARDS headers.
 * 3. Search for CARD_ID.
 * 4. Insert or update the record.
 *
 * @param {Object} cardRecord
 * @return {Object}
 */

function KGMIS_SaveCardRecord_(cardRecord) {

  if (
    !cardRecord ||
    typeof cardRecord !== "object" ||
    Array.isArray(cardRecord)
  ) {

    throw new Error(
      "A valid Card Record object is required."
    );

  }

  const requiredFields = [

    "CARD_ID",
    "FAMILY_ID",
    "CARDHOLDER_TYPE",
    "RELATION_SEQUENCE",
    "CARDHOLDER_NAME",
    "MEMBERSHIP_TYPE",
    "MEMBERSHIP_YEAR",
    "MEMBERSHIP_STATUS",
    "VALID_UNTIL",
    "CARD_STATUS",
    "CARD_STATE",
    "QR_TOKEN",
    "CARD_VERSION"

  ];

  requiredFields.forEach(function(fieldName) {

    const value =
      cardRecord[fieldName];

    if (
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    ) {

      throw new Error(
        fieldName +
        " is required in the Card Record."
      );

    }

  });

  const lock =
    LockService.getDocumentLock();

  lock.waitLock(
    30000
  );

  try {

    const spreadsheet =
      SpreadsheetApp.getActiveSpreadsheet();

    const sheet =
      spreadsheet.getSheetByName(
        "KEFG_MEMBER_CARDS"
      );

    if (!sheet) {

      throw new Error(
        'Sheet "KEFG_MEMBER_CARDS" was not found.'
      );

    }

    const lastColumn =
      sheet.getLastColumn();

    if (lastColumn < 1) {

      throw new Error(
        "KEFG_MEMBER_CARDS does not contain headers."
      );

    }

    const headers =
      sheet
        .getRange(
          1,
          1,
          1,
          lastColumn
        )
        .getDisplayValues()[0]
        .map(function(header) {

          return String(header || "")
            .trim()
            .toUpperCase();

        });

    /*
     * Check for blank or duplicate headers.
     */

    const blankHeaderColumns =
      [];

    const duplicateHeaders =
      [];

    const headerTracker =
      {};

    headers.forEach(function(header, index) {

      if (!header) {

        blankHeaderColumns.push(
          index + 1
        );

        return;

      }

      if (headerTracker[header]) {

        duplicateHeaders.push(
          header
        );

      }

      headerTracker[header] =
        true;

    });

    if (blankHeaderColumns.length > 0) {

      throw new Error(
        "Blank header found in KEFG_MEMBER_CARDS at column(s): " +
        blankHeaderColumns.join(", ")
      );

    }

    if (duplicateHeaders.length > 0) {

      throw new Error(
        "Duplicate header(s) found in KEFG_MEMBER_CARDS: " +
        duplicateHeaders.join(", ")
      );

    }

    /*
     * Confirm that every required registry header exists.
     */

    const requiredRegistryHeaders = [

      "CARD_ID",
      "FAMILY_ID",
      "KEFG_ID",
      "CARDHOLDER_TYPE",
      "RELATION_SEQUENCE",
      "CARDHOLDER_NAME",
      "MEMBERSHIP_TYPE",
      "MEMBERSHIP_YEAR",
      "MEMBERSHIP_STATUS",
      "ISSUE_DATE",
      "VALID_UNTIL",
      "CARD_STATUS",
      "CARD_STATE",
      "MEMBER_MOBILE",
      "MEMBER_EMAIL",
      "PHOTO_FILE_ID",
      "PHOTO_URL",
      "QR_TOKEN",
      "CARD_PDF_FILE_ID",
      "CARD_PDF_FILE_URL",
      "CARD_IMAGE_FILE_ID",
      "CARD_IMAGE_FILE_URL",
      "CREATED_ON",
      "CREATED_BY",
      "UPDATED_ON",
      "UPDATED_BY",
      "CARD_VERSION",
      "LAST_VERIFIED_ON",
      "REMARKS"

    ];

    const missingHeaders =
      requiredRegistryHeaders.filter(
        function(requiredHeader) {

          return !headers.includes(
            requiredHeader
          );

        }
      );

    if (missingHeaders.length > 0) {

      throw new Error(
        "Missing KEFG_MEMBER_CARDS header(s): " +
        missingHeaders.join(", ")
      );

    }

    /*
     * Locate CARD_ID column.
     */

    const cardIdColumnIndex =
      headers.indexOf(
        "CARD_ID"
      );

    const cardIdColumnNumber =
      cardIdColumnIndex + 1;

    const lastRow =
      sheet.getLastRow();

    let existingRowNumber =
      0;

    if (lastRow >= 2) {

      const cardIdValues =
        sheet
          .getRange(
            2,
            cardIdColumnNumber,
            lastRow - 1,
            1
          )
          .getDisplayValues();

      const normalizedCardId =
        String(
          cardRecord.CARD_ID
        ).trim();

      for (
        let index = 0;
        index < cardIdValues.length;
        index++
      ) {

        const existingCardId =
          String(
            cardIdValues[index][0] || ""
          ).trim();

        if (
          existingCardId ===
          normalizedCardId
        ) {

          existingRowNumber =
            index + 2;

          break;

        }

      }

    }

    if (existingRowNumber > 0) {

      return KGMIS_UpdateCardRecord_(
        sheet,
        headers,
        existingRowNumber,
        cardRecord
      );

    }

    return KGMIS_InsertCardRecord_(
      sheet,
      headers,
      cardRecord
    );

  } finally {

    lock.releaseLock();

  }

}


/**
 * ============================================================
 * 4D.5 – DATABASE WRITE TEST
 * ============================================================
 *
 * This test writes an actual test record into:
 *
 * KEFG_MEMBER_CARDS
 *
 * First execution:
 * INSERTED
 *
 * Subsequent executions:
 * UPDATED
 *
 * Test identifiers:
 *
 * CARD_ID  = KEFG9999901
 * FAMILY_ID = FAM99999
 */

function KGMIS_TestSaveCardRecord() {

  const testCardRecord = {

    CARD_ID:
      "KEFG9999901",

    FAMILY_ID:
      "FAM99999",

    KEFG_ID:
      "KEFG_TEST",

    CARDHOLDER_TYPE:
      "PRIMARY MEMBER",

    RELATION_SEQUENCE:
      "01",

    CARDHOLDER_NAME:
      "Database Test Member",

    MEMBERSHIP_TYPE:
      "FAMILY",

    MEMBERSHIP_YEAR:
      "2026-27",

    MEMBERSHIP_STATUS:
      "CURRENT",

    ISSUE_DATE:
      new Date(),

    VALID_UNTIL:
      KGMIS_GetCardValidityDate_(
        "2026-27"
      ),

    CARD_STATUS:
      "CURRENT",

    CARD_STATE:
      "GENERATED",

    MEMBER_MOBILE:
      "9999999999",

    MEMBER_EMAIL:
      "database.test@kefglobal.org",

    PHOTO_FILE_ID:
      "",

    PHOTO_URL:
      "",

    QR_TOKEN:
      "KGMIS-TEST-CARD-DATABASE-99999",

    CARD_PDF_FILE_ID:
      "",

    CARD_PDF_FILE_URL:
      "",

    CARD_IMAGE_FILE_ID:
      "",

    CARD_IMAGE_FILE_URL:
      "",

    CREATED_ON:
      new Date(),

    CREATED_BY:
      Session
        .getEffectiveUser()
        .getEmail() ||
      "SYSTEM",

    UPDATED_ON:
      "",

    UPDATED_BY:
      "",

    CARD_VERSION:
      "1.0",

    LAST_VERIFIED_ON:
      "",

    REMARKS:
      "Part 4D database write test"

  };

  const result =
    KGMIS_SaveCardRecord_(
      testCardRecord
    );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;

}