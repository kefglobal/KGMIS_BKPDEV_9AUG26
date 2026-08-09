/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Payment Voucher PDF Service
 *
 * File:
 * 12_KGMIS_Payment_Voucher_PDF_Service.gs
 * ============================================================
 *
 * Responsibilities:
 * - Generate printable payment-voucher PDFs
 * - Return an existing PDF instead of creating duplicates
 * - Regenerate a voucher after a layout/logo change
 * - Store Google Drive references in
 *   KGMIS_PAYMENT_TRANSACTIONS
 *
 * Required KGMIS_CONFIG entries:
 *
 * PAYMENT_VOUCHER_FOLDER_ID:
 *   "GOOGLE_DRIVE_FOLDER_ID",
 *
 * RECEIPT_LOGO_FILE_ID:
 *   "GOOGLE_DRIVE_LOGO_FILE_ID",
 *
 * The KEF Global logo already configured for receipts is reused.
 */


/**
 * Generates or returns an existing payment-voucher PDF.
 *
 * Accepts either:
 * - PAYMENT_ID
 * - VOUCHER_NUMBER
 *
 * Examples:
 *
 * KGMIS_GeneratePaymentVoucherPdf('PAY000001');
 * KGMIS_GeneratePaymentVoucherPdf(
 *   'KEFG-PV/2026-27/000001'
 * );
 */
function KGMIS_GeneratePaymentVoucherPdf(
  paymentIdOrVoucherNumber
) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const lookupValue =
    KGMIS_PaymentVoucherCleanValue_(
      paymentIdOrVoucherNumber
    );

  if (!lookupValue) {
    throw new Error(
      'Payment ID or voucher number is required.'
    );
  }

  const folderId =
    KGMIS_PaymentVoucherCleanValue_(
      KGMIS_CONFIG.PAYMENT_VOUCHER_FOLDER_ID
    );

  if (!folderId) {
    throw new Error(
      'PAYMENT_VOUCHER_FOLDER_ID is missing from KGMIS_CONFIG.'
    );
  }

  const context =
    KGMIS_GetPaymentContext_();

  const transaction =
    KGMIS_FindPaymentTransaction_(
      context,
      lookupValue
    );

  if (
    transaction.recordStatus !== 'ACTIVE'
  ) {
    throw new Error(
      'A payment voucher cannot be generated for a cancelled or inactive transaction.'
    );
  }

  const allowedStatuses = [
    'APPROVED',
    'PARTIALLY PAID',
    'PAID',
    'REFUNDED'
  ];

  if (
    !allowedStatuses.includes(
      transaction.paymentStatus
    )
  ) {
    throw new Error(
      'A payment voucher can be generated only for an approved or completed payment.'
    );
  }

  if (!transaction.voucherNumber) {
    throw new Error(
      'Voucher number is missing for this payment transaction.'
    );
  }

  /*
   * Return the existing PDF if it still exists.
   */
  if (
    transaction.voucherFileId &&
    KGMIS_PaymentVoucherFileExists_(
      transaction.voucherFileId
    )
  ) {
    const existingFile =
      DriveApp.getFileById(
        transaction.voucherFileId
      );

    return {
      success: true,
      alreadyGenerated: true,
      paymentId:
        transaction.paymentId,
      voucherNumber:
        transaction.voucherNumber,
      fileId:
        existingFile.getId(),
      fileName:
        existingFile.getName(),
      fileUrl:
        existingFile.getUrl(),
      message:
        'The payment-voucher PDF had already been generated.'
    };
  }

  const folder =
    DriveApp.getFolderById(
      folderId
    );

  const fileName =
    KGMIS_CreatePaymentVoucherFileName_(
      transaction.voucherNumber
    );

  const temporaryDocument =
    KGMIS_CreatePaymentVoucherDocument_(
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
   * Remove the temporary Google Doc.
   */
  temporaryFile.setTrashed(true);

  const generatedOn =
    new Date();

  KGMIS_SavePaymentVoucherReference_(
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
    paymentId:
      transaction.paymentId,
    voucherNumber:
      transaction.voucherNumber,
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
      `Payment-voucher PDF ${fileName} was generated successfully.`
  };
}


/**
 * Deletes the old PDF, clears stored references,
 * and generates a fresh payment-voucher PDF.
 */
function KGMIS_RegeneratePaymentVoucherPdf(
  paymentIdOrVoucherNumber
) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const lookupValue =
    KGMIS_PaymentVoucherCleanValue_(
      paymentIdOrVoucherNumber
    );

  if (!lookupValue) {
    throw new Error(
      'Payment ID or voucher number is required.'
    );
  }

  const context =
    KGMIS_GetPaymentContext_();

  const transaction =
    KGMIS_FindPaymentTransaction_(
      context,
      lookupValue
    );

  if (transaction.voucherFileId) {
    try {
      DriveApp
        .getFileById(
          transaction.voucherFileId
        )
        .setTrashed(true);

    } catch (error) {
      console.error(
        'The previous payment-voucher PDF could not be moved to Trash:',
        error
      );
    }
  }

  const columnsToClear = [
    context.column.VOUCHER_FILE_ID,
    context.column.VOUCHER_FILE_URL,
    context.column.VOUCHER_FILE_NAME,
    context.column.VOUCHER_GENERATED_ON
  ];

  columnsToClear.forEach(
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

  return KGMIS_GeneratePaymentVoucherPdf(
    lookupValue
  );
}


/**
 * Finds a payment transaction using:
 * - PAYMENT_ID
 * - VOUCHER_NUMBER
 */
function KGMIS_FindPaymentTransaction_(
  context,
  lookupValue
) {
  const target =
    KGMIS_PaymentVoucherCleanValue_(
      lookupValue
    ).toUpperCase();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const paymentId =
      KGMIS_PaymentVoucherCleanValue_(
        row[
          context.column.PAYMENT_ID
        ]
      ).toUpperCase();

    const voucherNumber =
      KGMIS_PaymentVoucherCleanValue_(
        row[
          context.column.VOUCHER_NUMBER
        ]
      ).toUpperCase();

    if (
      paymentId !== target &&
      voucherNumber !== target
    ) {
      continue;
    }

    return {
      paymentId:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.PAYMENT_ID
          ]
        ),

      paymentDate:
        KGMIS_PaymentVoucherDate_(
          row[
            context.column.PAYMENT_DATE
          ]
        ),

      financialYear:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.FINANCIAL_YEAR
          ]
        ),

      paymentPurpose:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.PAYMENT_PURPOSE
          ]
        ),

      paymentCategory:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.PAYMENT_CATEGORY
          ]
        ),

      eventCode:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.EVENT_CODE
          ]
        ),

      eventProject:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.EVENT_PROJECT
          ]
        ),

      payeeName:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.PAYEE_NAME
          ]
        ),

      payeeType:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.PAYEE_TYPE
          ]
        ),

      vendorId:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.VENDOR_ID
          ]
        ),

      familyId:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.FAMILY_ID
          ]
        ),

      kefgId:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.KEFG_ID
          ]
        ),

      amount:
        Number(
          row[
            context.column.AMOUNT
          ] || 0
        ),

      paymentMode:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.PAYMENT_MODE
          ]
        ),

      transactionReference:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.TRANSACTION_REFERENCE
          ]
        ),

      invoiceNumber:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.INVOICE_NUMBER
          ]
        ),

      invoiceDate:
        KGMIS_PaymentVoucherDate_(
          row[
            context.column.INVOICE_DATE
          ]
        ),

      voucherNumber:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.VOUCHER_NUMBER
          ]
        ),

      voucherDate:
        KGMIS_PaymentVoucherDate_(
          row[
            context.column.VOUCHER_DATE
          ]
        ),

      voucherFileId:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.VOUCHER_FILE_ID
          ]
        ),

      voucherFileUrl:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.VOUCHER_FILE_URL
          ]
        ),

      voucherFileName:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.VOUCHER_FILE_NAME
          ]
        ),

      voucherGeneratedOn:
        KGMIS_PaymentVoucherDate_(
          row[
            context.column.VOUCHER_GENERATED_ON
          ]
        ),

      approvedBy:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.APPROVED_BY
          ]
        ),

      approvalDate:
        KGMIS_PaymentVoucherDate_(
          row[
            context.column.APPROVAL_DATE
          ]
        ),

      budgetHead:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.BUDGET_HEAD
          ]
        ),

      restrictedFund:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.RESTRICTED_FUND
          ]
        ),

      paymentStatus:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.PAYMENT_STATUS
          ]
        ).toUpperCase(),

      description:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.DESCRIPTION
          ]
        ),

      supportingDocumentId:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.SUPPORTING_DOCUMENT_ID
          ]
        ),

      recordStatus:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.RECORD_STATUS
          ]
        ).toUpperCase(),

      createdBy:
        KGMIS_PaymentVoucherCleanValue_(
          row[
            context.column.CREATED_BY
          ]
        ),

      sheetRow:
        rowIndex + 1
    };
  }

  throw new Error(
    `Payment transaction "${lookupValue}" was not found.`
  );
}


/**
 * Creates the temporary Google Document used to generate
 * the printable payment-voucher PDF.
 */
function KGMIS_CreatePaymentVoucherDocument_(
  transaction,
  authorisedUser
) {
  const documentTitle =
    'Temporary Payment Voucher - ' +
    transaction.voucherNumber;

  const document =
    DocumentApp.create(
      documentTitle
    );

  const body =
    document.getBody();

  body.clear();

  body.setMarginTop(18);
  body.setMarginBottom(18);
  body.setMarginLeft(24);
  body.setMarginRight(38);

  /*
   * ==========================================================
   * Header
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

  KGMIS_AppendPaymentVoucherLogo_(
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
    .setSpacingAfter(1);

  titleCell
    .appendParagraph(
      'Payment Voucher'
    )
    .setBold(true)
    .setFontSize(16)
    .setForegroundColor('#111827')
    .setSpacingBefore(0)
    .setSpacingAfter(0);

  body
    .appendParagraph('')
    .setSpacingBefore(0)
    .setSpacingAfter(4);

  /*
   * Voucher identification
   */
  const detailsTable =
    body.appendTable([
      [
        'Voucher Number',
        transaction.voucherNumber
      ],
      [
        'Voucher Date',
        KGMIS_PaymentVoucherFormatDate_(
          transaction.voucherDate ||
          transaction.paymentDate
        )
      ],
      [
        'Financial Year',
        transaction.financialYear
      ],
      [
        'Payment ID',
        transaction.paymentId
      ]
    ]);

  KGMIS_FormatPaymentVoucherTable_(
    detailsTable
  );

  /*
   * Payee section
   */
  KGMIS_AppendPaymentVoucherSectionTitle_(
    body,
    'Paid To'
  );

  body
    .appendParagraph(
      transaction.payeeName || '—'
    )
    .setBold(true)
    .setFontSize(13);

  const payeeParts = [];

  if (transaction.payeeType) {
    payeeParts.push(
      `Payee Type: ${transaction.payeeType}`
    );
  }

  if (transaction.vendorId) {
    payeeParts.push(
      `Vendor ID: ${transaction.vendorId}`
    );
  }

  if (transaction.familyId) {
    payeeParts.push(
      `Family ID: ${transaction.familyId}`
    );
  }

  if (transaction.kefgId) {
    payeeParts.push(
      `KEFG ID: ${transaction.kefgId}`
    );
  }

  if (payeeParts.length) {

  const payeeInfo =
    body.appendParagraph(
      payeeParts.join('    |    ')
    );

  payeeInfo
    .setFontSize(9)
    .setForegroundColor('#475569')
    .setSpacingAfter(10);     // increase the gap

}

  /*
   * Payment details
   */
  KGMIS_AppendPaymentVoucherSectionTitle_(
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
    ],
    [
      'Invoice Number',
      transaction.invoiceNumber ||
      '—'
    ],
    [
      'Invoice Date',
      transaction.invoiceDate
        ? KGMIS_PaymentVoucherFormatDate_(
            transaction.invoiceDate
          )
        : '—'
    ],
    [
      'Payment Status',
      transaction.paymentStatus
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

  if (transaction.budgetHead) {
    paymentRows.push([
      'Budget Head',
      transaction.budgetHead
    ]);
  }

  const paymentTable =
    body.appendTable(
      paymentRows
    );

  KGMIS_FormatPaymentVoucherTable_(
    paymentTable
  );

  /*
   * Amount
   */
  const amountParagraph =
    body.appendParagraph(
      '₹' +
      KGMIS_PaymentVoucherFormatAmount_(
        transaction.amount
      )
    );

  amountParagraph
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setBold(true)
    .setFontSize(21)
    .setForegroundColor('#8A3A12')
    .setSpacingBefore(8)
    .setSpacingAfter(2);

  const amountWords =
    body.appendParagraph(
      KGMIS_PaymentVoucherAmountToWords_(
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
   * Approval details
   */
  if (
    transaction.approvedBy ||
    transaction.approvalDate
  ) {
    KGMIS_AppendPaymentVoucherSectionTitle_(
      body,
      'Approval'
    );

    const approvalTable =
      body.appendTable([
        [
          'Approved By',
          transaction.approvedBy || '—'
        ],
        [
          'Approval Date',
          transaction.approvalDate
            ? KGMIS_PaymentVoucherFormatDate_(
                transaction.approvalDate
              )
            : '—'
        ]
      ]);

    KGMIS_FormatPaymentVoucherTable_(
      approvalTable
    );
  }

  /*
   * Description
   */
  if (transaction.description) {
    KGMIS_AppendPaymentVoucherSectionTitle_(
      body,
      'Description'
    );

    body
      .appendParagraph(
        transaction.description
      )
      .setFontSize(10);
  }

  body
    .appendParagraph('')
    .setSpacingAfter(2);

  /*
   * ==========================================================
   * Footer
   * ==========================================================
   */

  const certification =
    body.appendParagraph(
      'This is a computer-generated payment voucher. No physical signature is required.\n' +
      'Generated using KGMIS by ' +
      authorisedUser.userName +
      ' (' +
      authorisedUser.role +
      ')'
    );

  certification
    .setAlignment(
      DocumentApp.HorizontalAlignment.CENTER
    )
    .setFontSize(9)
    .setForegroundColor('#64748B')
    .setSpacingBefore(2)
    .setSpacingAfter(0);

  document.saveAndClose();

  return document;
}


/**
 * Inserts the configured KEF Global logo.
 */
function KGMIS_AppendPaymentVoucherLogo_(
  cell
) {
  const logoFileId =
    KGMIS_PaymentVoucherCleanValue_(
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
      'Payment-voucher logo could not be inserted:',
      error
    );
  }
}


/**
 * Adds a section heading.
 */
function KGMIS_AppendPaymentVoucherSectionTitle_(
  body,
  title
) {
  body
    .appendParagraph(title)
    .setBold(true)
    .setFontSize(10)
    .setForegroundColor('#0D4E70')
    .setSpacingBefore(8)
    .setSpacingAfter(2);
}


/**
 * Formats voucher detail tables.
 */
function KGMIS_FormatPaymentVoucherTable_(
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
 * Saves voucher PDF metadata in the payment row.
 */
function KGMIS_SavePaymentVoucherReference_(
  context,
  sheetRow,
  pdfFile,
  generatedOn,
  authorisedUser
) {
  context.sheet
    .getRange(
      sheetRow,
      context.column.VOUCHER_FILE_ID + 1
    )
    .setValue(
      pdfFile.getId()
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.VOUCHER_FILE_URL + 1
    )
    .setValue(
      pdfFile.getUrl()
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.VOUCHER_FILE_NAME + 1
    )
    .setValue(
      pdfFile.getName()
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.VOUCHER_GENERATED_ON + 1
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
 * Creates a Google Drive-safe filename.
 */
function KGMIS_CreatePaymentVoucherFileName_(
  voucherNumber
) {
  return (
    'PaymentVoucher_' +
    KGMIS_PaymentVoucherCleanValue_(
      voucherNumber
    )
      .replace(
        /[\/\\:*?"<>|]/g,
        '-'
      ) +
    '.pdf'
  );
}


/**
 * Checks whether a Google Drive file exists.
 */
function KGMIS_PaymentVoucherFileExists_(
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
 * Returns a valid Date or null.
 */
function KGMIS_PaymentVoucherDate_(
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
 * Formats a date for the PDF.
 */
function KGMIS_PaymentVoucherFormatDate_(
  value
) {
  const date =
    KGMIS_PaymentVoucherDate_(
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
 * Formats an amount using Indian separators.
 */
function KGMIS_PaymentVoucherFormatAmount_(
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
 * Converts an amount to Indian-numbering words.
 */
function KGMIS_PaymentVoucherAmountToWords_(
  value
) {
  const amount =
    Number(value || 0);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw new Error(
      'Invalid payment amount.'
    );
  }

  const rupees =
    Math.floor(amount);

  const paise =
    Math.round(
      (amount - rupees) * 100
    );

  let words =
    KGMIS_PaymentVoucherIntegerToWords_(
      rupees
    ) +
    ' Rupees';

  if (paise > 0) {
    words +=
      ' and ' +
      KGMIS_PaymentVoucherIntegerToWords_(
        paise
      ) +
      ' Paise';
  }

  return words + ' Only';
}


/**
 * Converts an integer to Indian-numbering words.
 */
function KGMIS_PaymentVoucherIntegerToWords_(
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

  function belowThousand(part) {
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
function KGMIS_PaymentVoucherCleanValue_(
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
 * Confirms access to the payment-voucher folder.
 */
function KGMIS_TestPaymentVoucherFolderAccess() {
  const folderId =
    KGMIS_PaymentVoucherCleanValue_(
      KGMIS_CONFIG.PAYMENT_VOUCHER_FOLDER_ID
    );

  if (!folderId) {
    throw new Error(
      'PAYMENT_VOUCHER_FOLDER_ID is blank.'
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
 * Generates or returns the first test voucher PDF.
 */
function KGMIS_TestGenerateFirstPaymentVoucherPdf() {
  const result =
    KGMIS_GeneratePaymentVoucherPdf(
      'PAY000001'
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
 * Regenerates the first test voucher PDF.
 */
function KGMIS_TestRegenerateFirstPaymentVoucherPdf() {
  const result =
    KGMIS_RegeneratePaymentVoucherPdf(
      'PAY000001'
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
