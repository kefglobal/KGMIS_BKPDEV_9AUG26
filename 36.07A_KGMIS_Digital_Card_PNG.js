/**
 * ============================================================
 * SECTION 10.4 - SAVE GENERATED PNG
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_SaveGeneratedPng(
  cardId,
  pngDataUrl
) {

  const cleanCardId =
    KGMIS_DigitalCardRenderer_Clean_(
      cardId
    ).toUpperCase();

  if (!cleanCardId) {

    throw new Error(
      'CARD_ID is required.'
    );

  }

  const card =
    KGMIS_DigitalCardRenderer_ReadCardById_(
      cleanCardId
    );

  if (!card) {

    throw new Error(
      'Card not found: ' +
      cleanCardId
    );

  }

  const match =
    String(
      pngDataUrl || ''
    )
      .trim()
      .match(
        /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/
      );

  if (!match) {

    throw new Error(
      'A valid PNG data URL was not received.'
    );

  }

  const bytes =
    Utilities.base64Decode(
      match[1]
    );

  const folder =
    KGMIS_DigitalCardRenderer_GetPngFolder_();

  const fileName =
    cleanCardId +
    '_v' +
    String(
      card.CARD_VERSION || '1.0'
    ).replace(
      /[^0-9A-Za-z._-]/g,
      '_'
    ) +
    '.png';

  KGMIS_DigitalCardRenderer_TrashExistingPng_(
    card.CARD_IMAGE_FILE_ID
  );

  const file =
    folder.createFile(

      Utilities.newBlob(
        bytes,
        'image/png',
        fileName
      )

    );

  file.setSharing(

    DriveApp.Access.ANYONE_WITH_LINK,

    DriveApp.Permission.VIEW

  );

  const fileId =
    file.getId();

  const fileUrl =
    'https://drive.google.com/uc?export=download&id=' +
    encodeURIComponent(
      fileId
    );

  KGMIS_DigitalCardRenderer_UpdatePngColumns_(

    cleanCardId,

    fileId,

    fileUrl

  );

  return {

    success: true,

    cardId: cleanCardId,

    fileId: fileId,

    fileUrl: fileUrl,

    message:
      'PNG generated and saved successfully.'

  };

}

/**
 * ============================================================
 * SECTION 10.5 - GET PNG FOLDER
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_GetPngFolder_() {

  const folderId =
    KGMIS_DigitalCardRenderer_Clean_(
      KGMIS_CONFIG.DIGITAL_CARD_FOLDER_ID
    );

  if (!folderId) {

    throw new Error(
      "DIGITAL_CARD_FOLDER_ID is missing from KGMIS_CONFIG."
    );

  }

  try {

    return DriveApp.getFolderById(
      folderId
    );

  } catch (error) {

    throw new Error(

      "The configured Digital Membership Card folder " +

      "could not be opened. Check the Folder ID and permissions. " +

      KGMIS_DigitalCardRenderer_GetErrorMessage_(
        error
      )

    );

  }

}

/**
 * ============================================================
 * SECTION 10.5A - New Function added on 25 July 2026 
 * UPDATE PNG COLUMNS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_GetCardsSheet_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      'The KGMIS spreadsheet could not be opened.'
    );
  }

  const sheet =
    spreadsheet.getSheetByName(
      'KEFG_MEMBER_CARDS'
    );

  if (!sheet) {
    throw new Error(
      'Sheet not found: KEFG_MEMBER_CARDS'
    );
  }

  return sheet;
}


/**
 * ============================================================
 * SECTION 10.6 - UPDATE PNG COLUMNS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_UpdatePngColumns_(
  cardId,
  fileId,
  fileUrl
) {

  const sheet =
    KGMIS_DigitalCardRenderer_GetCardsSheet_();

  const data =
    sheet.getDataRange().getValues();

  if (data.length < 2) {

    throw new Error( 
      'KEFG_MEMBER_CARDS is empty.'
    );

  }

  const headers =
    data[0];

  const cardIdCol =
    headers.indexOf('CARD_ID');

  const fileIdCol =
    headers.indexOf('CARD_IMAGE_FILE_ID');

  const fileUrlCol =
    headers.indexOf('CARD_IMAGE_FILE_URL');

  if (
    cardIdCol === -1 ||
    fileIdCol === -1 ||
    fileUrlCol === -1
  ) {

    throw new Error(
      'Required columns are missing in KEFG_MEMBER_CARDS.'
    );

  }

  for (
    let r = 1;
    r < data.length;
    r++
  ) {

    if (
      String(
        data[r][cardIdCol]
      ).trim().toUpperCase() ===
      cardId
    ) {

      sheet
        .getRange(
          r + 1,
          fileIdCol + 1
        )
        .setValue(fileId);

      sheet
        .getRange(
          r + 1,
          fileUrlCol + 1
        )
        .setValue(fileUrl);

      return;

    }

  }

  throw new Error(
    'Card not found: ' +
    cardId
  );

}


/**
 * ============================================================
 * SECTION 10.7 - TRASH EXISTING PNG
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_TrashExistingPng_(
  fileId
) {

  const cleanFileId =
    KGMIS_DigitalCardRenderer_Clean_(fileId);

  if (!cleanFileId) {
    return;
  }

  try {

    const file =
      DriveApp.getFileById(
        cleanFileId
      );

    file.setTrashed(true);

  } catch (error) {

    Logger.log(

      "Previous PNG could not be trashed: " +

      KGMIS_DigitalCardRenderer_GetErrorMessage_(
        error
      )

    );

  }

}

