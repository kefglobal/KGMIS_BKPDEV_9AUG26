/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Receipt PDF Service
 *
 * File:
 * 10_KGMIS_Receipt_PDF_Service.gs
 * ============================================================
 *
 * Responsibilities:
 * - Generate printable PDF receipts
 * - Regenerate receipts when the layout or logo changes
 * - Store Google Drive file references in
 *   KGMIS_RECEIPT_TRANSACTIONS
 * - Return existing PDFs instead of creating duplicates
 * - Support Treasurer Portal receipt download
 */


/**
 * Generates or returns an existing receipt PDF.
 *
 * Accepts either TRANSACTION_ID or RECEIPT_NUMBER.
 *
 * Examples:
 * KGMIS_GenerateReceiptPdf('RCT000001');
 * KGMIS_GenerateReceiptPdf('KEFG/2026-27/000001');
 */
function KGMIS_GenerateReceiptPdf(
  transactionIdOrReceiptNumber
) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const lookupValue =
    KGMIS_ReceiptPdfCleanValue_(
      transactionIdOrReceiptNumber
    );

  if (!lookupValue) {
    throw new Error(
      'Transaction ID or receipt number is required.'
    );
  }

  const folderId =
    KGMIS_ReceiptPdfCleanValue_(
      KGMIS_CONFIG.RECEIPT_FOLDER_ID
    );

  if (!folderId) {
    throw new Error(
      'RECEIPT_FOLDER_ID is missing from KGMIS_CONFIG.'
    );
  }

  const context =
    KGMIS_GetReceiptContext_();

  const transaction =
    KGMIS_FindReceiptTransaction_(
      context,
      lookupValue
    );

  if (
    transaction.paymentStatus !==
    'SUCCESSFUL'
  ) {
    throw new Error(
      'A PDF receipt can be generated only for a SUCCESSFUL transaction.'
    );
  }

  if (
    transaction.recordStatus !==
    'ACTIVE'
  ) {
    throw new Error(
      'A PDF receipt cannot be generated for a cancelled or inactive transaction.'
    );
  }

  /*
   * Return the existing PDF if the stored file still exists.
   */
  if (
    transaction.receiptFileId &&
    KGMIS_ReceiptPdfFileExists_(
      transaction.receiptFileId
    )
  ) {
    const existingFile =
      DriveApp.getFileById(
        transaction.receiptFileId
      );

    return {
      success: true,
      alreadyGenerated: true,
      transactionId:
        transaction.transactionId,
      receiptNumber:
        transaction.receiptNumber,
      fileId:
        existingFile.getId(),
      fileName:
        existingFile.getName(),
      fileUrl:
        existingFile.getUrl(),
      message:
        'The receipt PDF had already been generated.'
    };
  }

  const folder =
    DriveApp.getFolderById(
      folderId
    );

  const fileName =
    KGMIS_CreateReceiptPdfFileName_(
      transaction.receiptNumber
    );

  const temporaryDocument =
    KGMIS_CreateReceiptDocument_(
      transaction,
      authorisedUser
    );

  const temporaryFile =
    DriveApp.getFileById(
      temporaryDocument.getId()
    );

  temporaryFile.moveTo(folder);

  const pdfBlob =
    temporaryFile
      .getAs(MimeType.PDF)
      .setName(fileName);

  const pdfFile =
    folder.createFile(
      pdfBlob
    );

  /*
   * Remove the temporary Google Doc after PDF creation.
   */
  temporaryFile.setTrashed(true);

  const generatedOn =
    new Date();

  KGMIS_SaveReceiptPdfReference_(
    context,
    transaction.sheetRow,
    pdfFile,
    generatedOn,
    authorisedUser
  );

  SpreadsheetApp.flush();

  return {
    success: true,
    alreadyGenerated: false,
    transactionId:
      transaction.transactionId,
    receiptNumber:
      transaction.receiptNumber,
    fileId:
      pdfFile.getId(),
    fileName:
      pdfFile.getName(),
    fileUrl:
      pdfFile.getUrl(),
    generatedOn:
      Utilities.formatDate(
        generatedOn,
        Session.getScriptTimeZone(),
        'dd-MMM-yyyy HH:mm:ss'
      ),
    generatedBy:
      authorisedUser.email,
    message:
      `Receipt PDF ${fileName} was generated successfully.`
  };
}


/**
 * Deletes the existing generated PDF, clears stored references,
 * and creates a fresh PDF using the current logo and layout.
 */
function KGMIS_RegenerateReceiptPdf(
  transactionIdOrReceiptNumber
) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const lookupValue =
    KGMIS_ReceiptPdfCleanValue_(
      transactionIdOrReceiptNumber
    );

  if (!lookupValue) {
    throw new Error(
      'Transaction ID or receipt number is required.'
    );
  }

  const context =
    KGMIS_GetReceiptContext_();

  const transaction =
    KGMIS_FindReceiptTransaction_(
      context,
      lookupValue
    );

  if (transaction.receiptFileId) {
    try {
      DriveApp
        .getFileById(
          transaction.receiptFileId
        )
        .setTrashed(true);

    } catch (error) {
      console.error(
        'The previous receipt PDF could not be moved to Trash:',
        error
      );
    }
  }

  const referenceColumns = [
    context.column.RECEIPT_FILE_ID,
    context.column.RECEIPT_FILE_URL,
    context.column.RECEIPT_FILE_NAME,
    context.column.RECEIPT_GENERATED_ON
  ];

  referenceColumns.forEach(
    zeroBasedColumn => {
      context.sheet
        .getRange(
          transaction.sheetRow,
          zeroBasedColumn + 1
        )
        .clearContent();
    }
  );

  const updatedOn =
    new Date();

  context.sheet
    .getRange(
      transaction.sheetRow,
      context.column.UPDATED_ON + 1
    )
    .setValue(updatedOn);

  context.sheet
    .getRange(
      transaction.sheetRow,
      context.column.UPDATED_BY + 1
    )
    .setValue(
      authorisedUser.email
    );

  SpreadsheetApp.flush();

  return KGMIS_GenerateReceiptPdf(
    lookupValue
  );
}


/**
 * Finds one receipt using TRANSACTION_ID or RECEIPT_NUMBER.
 */
function KGMIS_FindReceiptTransaction_(
  context,
  lookupValue
) {
  const target =
    KGMIS_ReceiptPdfCleanValue_(
      lookupValue
    ).toUpperCase();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const transactionId =
      KGMIS_ReceiptPdfCleanValue_(
        row[
          context.column.TRANSACTION_ID
        ]
      ).toUpperCase();

    const receiptNumber =
      KGMIS_ReceiptPdfCleanValue_(
        row[
          context.column.RECEIPT_NUMBER
        ]
      ).toUpperCase();

    if (
      transactionId !== target &&
      receiptNumber !== target
    ) {
      continue;
    }

    return {
      transactionId:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.TRANSACTION_ID
          ]
        ),

      transactionDate:
        KGMIS_ReceiptPdfDate_(
          row[
            context.column.TRANSACTION_DATE
          ]
        ),

      financialYear:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.FINANCIAL_YEAR
          ]
        ),

      familyId:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.FAMILY_ID
          ]
        ),

      kefgId:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.KEFG_ID
          ]
        ),

      paymentPurpose:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.PAYMENT_PURPOSE
          ]
        ),

      paymentCategory:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.PAYMENT_CATEGORY
          ]
        ),

      amount:
        Number(
          row[
            context.column.AMOUNT
          ] || 0
        ),

      paymentMode:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.PAYMENT_MODE
          ]
        ),

      transactionReference:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.TRANSACTION_REFERENCE
          ]
        ),

      receiptNumber:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.RECEIPT_NUMBER
          ]
        ),

      receiptDate:
        KGMIS_ReceiptPdfDate_(
          row[
            context.column.RECEIPT_DATE
          ]
        ),

      receiptFileId:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.RECEIPT_FILE_ID
          ]
        ),

      receiptFileUrl:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.RECEIPT_FILE_URL
          ]
        ),

      receiptFileName:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.RECEIPT_FILE_NAME
          ]
        ),

      receiptGeneratedOn:
        KGMIS_ReceiptPdfDate_(
          row[
            context.column.RECEIPT_GENERATED_ON
          ]
        ),

      payerName:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.PAYER_NAME
          ]
        ),

      payerRelation:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.PAYER_RELATION
          ]
        ),

      paymentStatus:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.PAYMENT_STATUS
          ]
        ).toUpperCase(),

      description:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.DESCRIPTION
          ]
        ),

      eventCode:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.EVENT_CODE
          ]
        ),

      eventProject:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.EVENT_PROJECT
          ]
        ),

      restrictedFund:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.RESTRICTED_FUND
          ]
        ),

      recordStatus:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.RECORD_STATUS
          ]
        ).toUpperCase(),

      sheetRow:
        rowIndex + 1
    };
  }

  throw new Error(
    `Receipt transaction "${lookupValue}" was not found.`
  );
}


/**
 * Creates the temporary Google Document used to generate
 * the printable PDF receipt.
 */
function KGMIS_CreateReceiptDocument_(
  transaction,
  authorisedUser
) {
  const documentTitle =
    'Temporary Receipt - ' +
    transaction.receiptNumber;

  const document =
    DocumentApp.create(
      documentTitle
    );

  const body =
    document.getBody();

  body.clear();

  body.setMarginTop(28);
  body.setMarginBottom(32);
  body.setMarginLeft(24);
  body.setMarginRight(38);

  /*
   * ==========================================================
   * Receipt header
   * ==========================================================
   */
  const headerTable =
    body.appendTable([
      ['', '']
    ]);

  headerTable.setBorderWidth(0);
  headerTable.setColumnWidth(0, 105);
  headerTable.setColumnWidth(1, 405);

  const headerRow =
    headerTable.getRow(0);

  const logoCell =
    headerRow.getCell(0);

  const titleCell =
    headerRow.getCell(1);

  logoCell.clear();
  titleCell.clear();

  logoCell
    .setVerticalAlignment(
      DocumentApp.VerticalAlignment.CENTER
    )
    .setPaddingTop(0)
    .setPaddingBottom(0)
    .setPaddingLeft(0)
    .setPaddingRight(2);

  titleCell
    .setVerticalAlignment(
      DocumentApp.VerticalAlignment.CENTER
    )
    .setPaddingTop(0)
    .setPaddingBottom(0)
    .setPaddingLeft(0)
    .setPaddingRight(0);

  KGMIS_AppendReceiptLogoToCell_(
    logoCell
  );

  titleCell
    .appendParagraph(
      'KEF GLOBAL'
    )
    .setBold(true)
    .setFontSize(15)
    .setForegroundColor('#0D4E70')
    .setSpacingBefore(0)
    .setSpacingAfter(2);

  titleCell
    .appendParagraph(
      'Official Receipt'
    )
    .setBold(true)
    .setFontSize(14)
    .setForegroundColor('#111827')
    .setSpacingBefore(0)
    .setSpacingAfter(0);

  body
    .appendParagraph('')
    .setSpacingBefore(0)
    .setSpacingAfter(4);

  /*
   * Receipt identification
   */
  const detailsTable =
    body.appendTable([
      [
        'Receipt Number',
        transaction.receiptNumber
      ],
      [
        'Receipt Date',
        KGMIS_ReceiptPdfFormatDate_(
          transaction.receiptDate ||
          transaction.transactionDate
        )
      ],
      [
        'Financial Year',
        transaction.financialYear
      ],
      [
        'Transaction ID',
        transaction.transactionId
      ]
    ]);

  KGMIS_FormatReceiptDetailsTable_(
    detailsTable
  );

  body
    .appendParagraph('')
    .setSpacingAfter(1);

  /*
   * Payer details
   */
  KGMIS_AppendReceiptSectionTitle_(
    body,
    'Received From'
  );

  body
    .appendParagraph(
      transaction.payerName || '—'
    )
    .setBold(true)
    .setFontSize(13);

  const identityParts = [];

  if (transaction.familyId) {
    identityParts.push(
      `Family ID: ${transaction.familyId}`
    );
  }

  if (transaction.kefgId) {
    identityParts.push(
      `KEFG ID: ${transaction.kefgId}`
    );
  }

  if (transaction.payerRelation) {
    identityParts.push(
      (
        transaction.familyId
          ? 'Relation: '
          : 'Party Type: '
      ) +
      transaction.payerRelation
    );
  }

  if (identityParts.length) {
    body
      .appendParagraph(
        identityParts.join('    |    ')
      )
      .setFontSize(9)
      .setForegroundColor('#475569');
  }

  /*
   * Payment details
   */
  KGMIS_AppendReceiptSectionTitle_(
    body,
    'Payment Details'
  );

  const paymentRows = [
    [
      'Payment Purpose',
      transaction.paymentPurpose
    ],
    [
      'Payment Category',
      transaction.paymentCategory
    ],
    [
      'Payment Mode',
      transaction.paymentMode
    ],
    [
      'Transaction Reference',
      transaction.transactionReference ||
      '—'
    ]
  ];

  if (
    transaction.eventCode ||
    transaction.eventProject
  ) {
    paymentRows.push([
      'Event / Project',
      [
        transaction.eventCode,
        transaction.eventProject
      ]
        .filter(Boolean)
        .join(' — ')
    ]);
  }

  const paymentTable =
    body.appendTable(
      paymentRows
    );

  KGMIS_FormatReceiptDetailsTable_(
    paymentTable
  );

  /*
   * Amount
   */
  const amountParagraph =
    body.appendParagraph(
      '₹' +
      KGMIS_ReceiptPdfFormatAmount_(
        transaction.amount
      )
    );

  amountParagraph
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setBold(true)
    .setFontSize(21)
    .setForegroundColor('#16723A')
    .setSpacingBefore(14)
    .setSpacingAfter(3);

  const amountWords =
    body.appendParagraph(
      KGMIS_AmountToIndianWords_(
        transaction.amount
      )
    );

  amountWords
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setItalic(true)
    .setFontSize(10);

  /*
   * Remarks
   */
  if (transaction.description) {
    KGMIS_AppendReceiptSectionTitle_(
      body,
      'Remarks'
    );

    body
      .appendParagraph(
        transaction.description
      )
      .setFontSize(10);
  }

  body
    .appendParagraph('')
    .setSpacingAfter(10);

  /*
   * Footer
   */
  const certification =
    body.appendParagraph(
      'This is a computer-generated receipt. ' +
      'No physical signature is required.'
    );

  certification
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setFontSize(9)
    .setForegroundColor('#64748B');

  const generatedBy =
    body.appendParagraph(
      'Generated using KGMIS by ' +
      authorisedUser.userName +
      ' (' +
      authorisedUser.role +
      ')'
    );

  generatedBy
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setFontSize(8)
    .setForegroundColor('#94A3B8');

  document.saveAndClose();

  return document;
}


/**
 * Inserts the KEF Global logo into the left header cell.
 */
function KGMIS_AppendReceiptLogoToCell_(
  cell
) {
  const logoFileId =
    KGMIS_ReceiptPdfCleanValue_(
      KGMIS_CONFIG.RECEIPT_LOGO_FILE_ID
    );

  if (!logoFileId) {
    return;
  }

  try {
    const logoBlob =
      DriveApp
        .getFileById(
          logoFileId
        )
        .getBlob();

    const image =
      cell.appendImage(
        logoBlob
      );

    image.setWidth(105);
    image.setHeight(105);

    const parent =
      image.getParent();

    if (
      parent &&
      parent.getType() ===
        DocumentApp.ElementType.PARAGRAPH
    ) {
      parent
        .asParagraph()
        .setAlignment(
          DocumentApp.HorizontalAlignment.CENTER
        )
        .setSpacingBefore(0)
        .setSpacingAfter(0);
    }

  } catch (error) {
    console.error(
      'Receipt logo could not be inserted:',
      error
    );
  }
}


/**
 * Adds a receipt section heading.
 */
function KGMIS_AppendReceiptSectionTitle_(
  body,
  title
) {
  body
    .appendParagraph(title)
    .setBold(true)
    .setFontSize(10)
    .setForegroundColor('#0D4E70')
    .setSpacingBefore(13)
    .setSpacingAfter(4);
}


/**
 * Formats receipt detail tables.
 */
function KGMIS_FormatReceiptDetailsTable_(
  table
) {
  table.setBorderWidth(0.5);
  table.setBorderColor('#CBD5E1');

  for (
    let rowIndex = 0;
    rowIndex < table.getNumRows();
    rowIndex++
  ) {
    const row =
      table.getRow(rowIndex);

    const labelCell =
      row.getCell(0);

    const valueCell =
      row.getCell(1);

    labelCell
      .setBackgroundColor('#F1F5F9');

    labelCell
      .editAsText()
      .setBold(true)
      .setFontSize(9)
      .setForegroundColor('#334155');

    valueCell
      .editAsText()
      .setFontSize(9)
      .setForegroundColor('#111827');
  }
}


/**
 * Saves PDF metadata against the receipt transaction.
 */
function KGMIS_SaveReceiptPdfReference_(
  context,
  sheetRow,
  pdfFile,
  generatedOn,
  authorisedUser
) {
  context.sheet
    .getRange(
      sheetRow,
      context.column.RECEIPT_FILE_ID + 1
    )
    .setValue(
      pdfFile.getId()
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.RECEIPT_FILE_URL + 1
    )
    .setValue(
      pdfFile.getUrl()
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.RECEIPT_FILE_NAME + 1
    )
    .setValue(
      pdfFile.getName()
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.RECEIPT_GENERATED_ON + 1
    )
    .setValue(
      generatedOn
    )
    .setNumberFormat(
      'dd-MMM-yyyy HH:mm:ss'
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.UPDATED_ON + 1
    )
    .setValue(generatedOn);

  context.sheet
    .getRange(
      sheetRow,
      context.column.UPDATED_BY + 1
    )
    .setValue(
      authorisedUser.email
    );
}


/**
 * Creates a Google Drive-safe PDF filename.
 */
function KGMIS_CreateReceiptPdfFileName_(
  receiptNumber
) {
  return (
    'Receipt_' +
    KGMIS_ReceiptPdfCleanValue_(
      receiptNumber
    )
      .replace(
        /[\/\\:*?"<>|]/g,
        '-'
      ) +
    '.pdf'
  );
}


/**
 * Checks whether a stored Google Drive file exists.
 */
function KGMIS_ReceiptPdfFileExists_(
  fileId
) {
  try {
    DriveApp
      .getFileById(fileId)
      .getName();

    return true;

  } catch (error) {
    return false;
  }
}


/**
 * Returns a valid Date object or null.
 */
function KGMIS_ReceiptPdfDate_(
  value
) {
  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  return null;
}


/**
 * Formats a receipt date.
 */
function KGMIS_ReceiptPdfFormatDate_(
  value
) {
  const date =
    KGMIS_ReceiptPdfDate_(
      value
    );

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'dd-MMM-yyyy'
  );
}


/**
 * Formats an amount using Indian-style separators.
 */
function KGMIS_ReceiptPdfFormatAmount_(
  value
) {
  return Number(
    value || 0
  ).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  );
}


/**
 * Converts an amount into Indian-numbering words.
 */
function KGMIS_AmountToIndianWords_(
  value
) {
  const amount =
    Number(value || 0);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error(
      'Invalid receipt amount.'
    );
  }

  const rupees =
    Math.floor(amount);

  const paise =
    Math.round(
      (amount - rupees) * 100
    );

  let words =
    KGMIS_IntegerToIndianWords_(
      rupees
    ) +
    ' Rupees';

  if (paise > 0) {
    words +=
      ' and ' +
      KGMIS_IntegerToIndianWords_(
        paise
      ) +
      ' Paise';
  }

  return words + ' Only';
}


/**
 * Converts a non-negative integer to Indian-numbering words.
 */
function KGMIS_IntegerToIndianWords_(
  number
) {
  const value =
    Math.floor(
      Number(number || 0)
    );

  if (value === 0) {
    return 'Zero';
  }

  const units = [
    '',
    'One',
    'Two',
    'Three',
    'Four',
    'Five',
    'Six',
    'Seven',
    'Eight',
    'Nine',
    'Ten',
    'Eleven',
    'Twelve',
    'Thirteen',
    'Fourteen',
    'Fifteen',
    'Sixteen',
    'Seventeen',
    'Eighteen',
    'Nineteen'
  ];

  const tens = [
    '',
    '',
    'Twenty',
    'Thirty',
    'Forty',
    'Fifty',
    'Sixty',
    'Seventy',
    'Eighty',
    'Ninety'
  ];

  function belowThousand(
    part
  ) {
    const words = [];

    if (part >= 100) {
      words.push(
        units[
          Math.floor(part / 100)
        ],
        'Hundred'
      );

      part %= 100;
    }

    if (part >= 20) {
      words.push(
        tens[
          Math.floor(part / 10)
        ]
      );

      if (part % 10) {
        words.push(
          units[part % 10]
        );
      }

    } else if (part > 0) {
      words.push(
        units[part]
      );
    }

    return words.join(' ');
  }

  const parts = [];

  const crore =
    Math.floor(
      value / 10000000
    );

  let remainder =
    value % 10000000;

  const lakh =
    Math.floor(
      remainder / 100000
    );

  remainder %= 100000;

  const thousand =
    Math.floor(
      remainder / 1000
    );

  remainder %= 1000;

  if (crore) {
    parts.push(
      belowThousand(crore),
      'Crore'
    );
  }

  if (lakh) {
    parts.push(
      belowThousand(lakh),
      'Lakh'
    );
  }

  if (thousand) {
    parts.push(
      belowThousand(thousand),
      'Thousand'
    );
  }

  if (remainder) {
    parts.push(
      belowThousand(remainder)
    );
  }

  return parts.join(' ');
}


/**
 * Cleans general text values.
 */
function KGMIS_ReceiptPdfCleanValue_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


/**
 * Called by the Treasurer Portal.
 *
 * Finds the latest successful receipt for a family and either
 * generates its PDF or returns the existing PDF.
 */
function KGMIS_Treasurer_GenerateLatestFamilyReceipt(
  familyId,
  financialYear
) {
  KGMIS_RequireTreasurerViewAccess_();

  const safeFamilyId =
    KGMIS_ReceiptPdfCleanValue_(
      familyId
    );

  if (!safeFamilyId) {
    throw new Error(
      'Family ID is required.'
    );
  }

  const yearRecord =
    financialYear
      ? KGMIS_GetFinancialYear(
          financialYear
        )
      : KGMIS_GetCurrentFinancialYear();

  const transaction =
    KGMIS_FindLatestFamilyReceipt_(
      safeFamilyId,
      yearRecord.financialYear
    );

  return KGMIS_GenerateReceiptPdf(
    transaction.transactionId
  );
}


/**
 * Finds the latest ACTIVE and SUCCESSFUL receipt for a family.
 */
function KGMIS_FindLatestFamilyReceipt_(
  familyId,
  financialYear
) {
  const context =
    KGMIS_GetReceiptContext_();

  const matches = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const rowFamilyId =
      KGMIS_ReceiptPdfCleanValue_(
        row[
          context.column.FAMILY_ID
        ]
      );

    const rowFinancialYear =
      KGMIS_ReceiptPdfCleanValue_(
        row[
          context.column.FINANCIAL_YEAR
        ]
      );

    const paymentStatus =
      KGMIS_ReceiptPdfCleanValue_(
        row[
          context.column.PAYMENT_STATUS
        ]
      ).toUpperCase();

    const recordStatus =
      KGMIS_ReceiptPdfCleanValue_(
        row[
          context.column.RECORD_STATUS
        ]
      ).toUpperCase();

    if (
      rowFamilyId !== familyId ||
      rowFinancialYear !== financialYear ||
      paymentStatus !== 'SUCCESSFUL' ||
      recordStatus !== 'ACTIVE'
    ) {
      continue;
    }

    matches.push({
      transactionId:
        KGMIS_ReceiptPdfCleanValue_(
          row[
            context.column.TRANSACTION_ID
          ]
        ),

      transactionDate:
        KGMIS_ReceiptPdfDate_(
          row[
            context.column.TRANSACTION_DATE
          ]
        ),

      sheetRow:
        rowIndex + 1
    });
  }

  if (!matches.length) {
    throw new Error(
      `No successful receipt was found for ${familyId} ` +
      `in financial year ${financialYear}.`
    );
  }

  matches.sort(
    (first, second) => {
      const firstTime =
        first.transactionDate
          ? first.transactionDate.getTime()
          : 0;

      const secondTime =
        second.transactionDate
          ? second.transactionDate.getTime()
          : 0;

      if (secondTime !== firstTime) {
        return secondTime -
          firstTime;
      }

      return second.sheetRow -
        first.sheetRow;
    }
  );

  return matches[0];
}


/**
 * Confirms access to the configured receipt folder.
 */
function KGMIS_TestReceiptFolderAccess() {
  const folderId =
    KGMIS_ReceiptPdfCleanValue_(
      KGMIS_CONFIG.RECEIPT_FOLDER_ID
    );

  if (!folderId) {
    throw new Error(
      'RECEIPT_FOLDER_ID is blank.'
    );
  }

  const folder =
    DriveApp.getFolderById(
      folderId
    );

  const result = {
    folderId:
      folder.getId(),
    folderName:
      folder.getName(),
    folderUrl:
      folder.getUrl()
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * Confirms access to the configured logo file.
 */
function KGMIS_TestReceiptLogoAccess() {
  const logoFileId =
    KGMIS_ReceiptPdfCleanValue_(
      KGMIS_CONFIG.RECEIPT_LOGO_FILE_ID
    );

  if (!logoFileId) {
    throw new Error(
      'RECEIPT_LOGO_FILE_ID is blank.'
    );
  }

  const file =
    DriveApp.getFileById(
      logoFileId
    );

  const result = {
    logoFileId:
      file.getId(),
    logoFileName:
      file.getName(),
    mimeType:
      file.getMimeType()
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * Generates or returns the first test receipt PDF.
 */
function KGMIS_TestGenerateFirstReceiptPdf() {
  const result =
    KGMIS_GenerateReceiptPdf(
      'RCT000001'
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


/**
 * Regenerates the first test receipt PDF using the current
 * logo and receipt layout.
 */
function KGMIS_TestRegenerateFirstReceiptPdf() {
  const result =
    KGMIS_RegenerateReceiptPdf(
      'RCT000001'
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
