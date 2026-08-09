/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Digital Membership Card Service
 *
 * File: 32.00_KGMIS_Digital_Card.gs
 * Developed by: JJA Global Systems
 * ============================================================
 *
 * CARD_ID format:
 *   KEFG + six-digit family number + two-digit relation sequence
 * Example: FAM00035 + 01 = KEFG00003501
 *
 * CARD_STATUS values:
 *   ACTIVE, EXTENDED, REVOKED
 */

const KGMIS_DIGITAL_CARD_CONFIG = Object.freeze({
  MEMBER_CARDS_SHEET: 'KEFG_MEMBER_CARDS',
  FAMILY_MEMBERS_SHEET: 'KEFG_FAMILY_MEMBERS',
  CARD_PREFIX: 'KEFG',
  CARD_VERSION: '1.0',
  MEMBER_CARD_HEADERS: Object.freeze([
    'CARD_ID', 'FAMILY_ID', 'KEFG_ID', 'CARDHOLDER_TYPE',
    'RELATION_SEQUENCE', 'CARDHOLDER_NAME', 'MEMBERSHIP_TYPE',
    'MEMBERSHIP_YEAR', 'MEMBERSHIP_STATUS', 'ISSUE_DATE',
    'VALID_UNTIL', 'CARD_STATUS', 'MEMBER_MOBILE', 'MEMBER_EMAIL',
    'PHOTO_FILE_ID', 'PHOTO_URL', 'QR_TOKEN', 'CARD_PDF_FILE_ID',
    'CARD_PDF_FILE_URL', 'CARD_IMAGE_FILE_ID', 'CARD_IMAGE_FILE_URL',
    'CREATED_ON', 'CREATED_BY', 'UPDATED_ON', 'UPDATED_BY',
    'CARD_VERSION', 'REMARKS'
  ])
});

function KGMIS_DigitalCard_GetInitialData(sessionToken) {
  const context = KGMIS_DigitalCard_GetOwnFamilyContext_(sessionToken);
  const cards = KGMIS_DigitalCard_ReadCardsByFamily_(context.familyId);
  const people = KGMIS_DigitalCard_BuildPeople_(
    context.profile,
    context.familyMembers,
    cards
  );

  return {
    success: true,
    profile: {
      familyId: context.familyId,
      memberName: context.profile.memberName || '',
      spouseName: context.profile.spouseName || '',
      membershipType: KGMIS_DigitalCard_GetMembershipType_(context.profile),
      membershipYear: context.subscriptionYear,
      membershipStatus: context.profile.membershipStatus || ''
    },
    people: people,
    cards: cards.map(KGMIS_DigitalCard_CreateCardResponse_),
    summary: {
      eligible: people.filter(function (p) { return p.cardEligible; }).length,
      active: KGMIS_DigitalCard_CountStatus_(cards, 'ACTIVE'),
      extended: KGMIS_DigitalCard_CountStatus_(cards, 'EXTENDED'),
      revoked: KGMIS_DigitalCard_CountStatus_(cards, 'REVOKED')
    }
  };
}

function KGMIS_DigitalCard_IssueOwnCard(sessionToken, cardholderKey) {
  const context = KGMIS_DigitalCard_GetOwnFamilyContext_(sessionToken);
  const person = KGMIS_DigitalCard_FindPersonByKey_(
    context.profile,
    context.familyMembers,
    cardholderKey
  );

  if (!person) {
    throw new Error('The selected cardholder could not be found.');
  }

  if (!person.cardEligible) {
    throw new Error('The selected cardholder is not eligible for a digital card.');
  }

  const cardId = KGMIS_DigitalCard_BuildCardId_(
    context.familyId,
    person.relationSequence
  );

  const sheetContext = KGMIS_DigitalCard_GetSheetContext_();
  const existing = KGMIS_DigitalCard_FindCardById_(sheetContext, cardId);

  if (existing) {
    const existingStatus = KGMIS_DigitalCard_Clean_(
      existing.record.CARD_STATUS
    ).toUpperCase();

    if (existingStatus === 'ACTIVE' || existingStatus === 'EXTENDED') {
      throw new Error('An active digital card already exists for this cardholder.');
    }

    if (existingStatus === 'REVOKED') {
      throw new Error('This card number has been revoked and cannot be activated again.');
    }
  }

  const now = new Date();
  const rowObject = {
    CARD_ID: cardId,
    FAMILY_ID: context.familyId,
    KEFG_ID: person.kefgId || '',
    CARDHOLDER_TYPE: person.cardholderType,
    RELATION_SEQUENCE: person.relationSequence,
    CARDHOLDER_NAME: person.cardholderName,
    MEMBERSHIP_TYPE: KGMIS_DigitalCard_GetMembershipType_(context.profile),
    MEMBERSHIP_YEAR: context.subscriptionYear,
    MEMBERSHIP_STATUS: context.profile.membershipStatus || '',
    ISSUE_DATE: KGMIS_DigitalCard_FormatDate_(now),
    VALID_UNTIL: KGMIS_DigitalCard_GetFinancialYearEnd_(context.subscriptionYear),
    CARD_STATUS: 'ACTIVE',
    MEMBER_MOBILE: person.mobile || '',
    MEMBER_EMAIL: person.email || '',
    PHOTO_FILE_ID: person.photoFileId || '',
    PHOTO_URL: person.photoUrl || '',
    QR_TOKEN: KGMIS_DigitalCard_GenerateQrToken_(),
    CARD_PDF_FILE_ID: '',
    CARD_PDF_FILE_URL: '',
    CARD_IMAGE_FILE_ID: '',
    CARD_IMAGE_FILE_URL: '',
    CREATED_ON: now,
    CREATED_BY: context.user.email || 'SYSTEM',
    UPDATED_ON: now,
    UPDATED_BY: context.user.email || 'SYSTEM',
    CARD_VERSION: KGMIS_DIGITAL_CARD_CONFIG.CARD_VERSION,
    REMARKS: 'Initial digital card issue'
  };

  sheetContext.sheet.appendRow(
    KGMIS_DigitalCard_ObjectToRow_(rowObject, sheetContext.headers)
  );

  return {
    success: true,
    message: 'Digital card issued successfully.',
    card: KGMIS_DigitalCard_CreateCardResponse_(rowObject)
  };
}

function KGMIS_DigitalCard_ExtendOwnCard(
  sessionToken,
  cardId,
  validUntil,
  remarks
) {
  const context = KGMIS_DigitalCard_GetOwnFamilyContext_(sessionToken);
  const parsedDate = KGMIS_DigitalCard_ParseIsoDate_(validUntil);

  if (!parsedDate) {
    throw new Error('Enter a valid extension date in YYYY-MM-DD format.');
  }

  const sheetContext = KGMIS_DigitalCard_GetSheetContext_();
  const match = KGMIS_DigitalCard_FindCardById_(
    sheetContext,
    KGMIS_DigitalCard_Clean_(cardId).toUpperCase()
  );

  if (!match) {
    throw new Error('The selected digital card was not found.');
  }

  KGMIS_DigitalCard_AssertOwnFamily_(match.record, context.familyId);

  if (KGMIS_DigitalCard_Clean_(match.record.CARD_STATUS).toUpperCase() === 'REVOKED') {
    throw new Error('A revoked card cannot be extended.');
  }

  KGMIS_DigitalCard_UpdateCardRow_(sheetContext, match.rowNumber, {
    VALID_UNTIL: KGMIS_DigitalCard_FormatDate_(parsedDate),
    CARD_STATUS: 'EXTENDED',
    UPDATED_ON: new Date(),
    UPDATED_BY: context.user.email || 'SYSTEM',
    CARD_VERSION: KGMIS_DigitalCard_IncrementVersion_(match.record.CARD_VERSION),
    REMARKS: KGMIS_DigitalCard_Clean_(remarks) || 'Card validity extended'
  });

  return {
    success: true,
    message: 'Digital card validity extended successfully.'
  };
}

function KGMIS_DigitalCard_RevokeOwnCard(sessionToken, cardId, reason) {
  const context = KGMIS_DigitalCard_GetOwnFamilyContext_(sessionToken);
  const cleanReason = KGMIS_DigitalCard_Clean_(reason);

  if (!cleanReason) {
    throw new Error('A reason is required to revoke the card.');
  }

  const sheetContext = KGMIS_DigitalCard_GetSheetContext_();
  const match = KGMIS_DigitalCard_FindCardById_(
    sheetContext,
    KGMIS_DigitalCard_Clean_(cardId).toUpperCase()
  );

  if (!match) {
    throw new Error('The selected digital card was not found.');
  }

  KGMIS_DigitalCard_AssertOwnFamily_(match.record, context.familyId);

  if (KGMIS_DigitalCard_Clean_(match.record.CARD_STATUS).toUpperCase() === 'REVOKED') {
    throw new Error('This digital card has already been revoked.');
  }

  KGMIS_DigitalCard_UpdateCardRow_(sheetContext, match.rowNumber, {
    CARD_STATUS: 'REVOKED',
    UPDATED_ON: new Date(),
    UPDATED_BY: context.user.email || 'SYSTEM',
    CARD_VERSION: KGMIS_DigitalCard_IncrementVersion_(match.record.CARD_VERSION),
    REMARKS: cleanReason
  });

  return {
    success: true,
    message: 'Digital card revoked successfully.'
  };
}

function KGMIS_DigitalCard_GetOwnFamilyContext_(sessionToken) {
  const user = KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'DIRECTORY',
    'VIEW'
  );

  const directoryContext = KGMIS_Directory_GetMasterContext_();
  const subscriptionYear = KGMIS_Directory_GetCurrentYearLabel_();
  const membershipStatusMap = KGMIS_Directory_GetCurrentMembershipStatusMap_(
    subscriptionYear
  );
  const directory = KGMIS_Directory_BuildFamilyDirectory_(
    directoryContext,
    membershipStatusMap,
    subscriptionYear
  );
  const profile = KGMIS_Directory_FindProfileByLoginEmail_(
    directory,
    user.email
  );

  if (!profile) {
    throw new Error('No family profile is linked to your signed-in email.');
  }

  const familyId = KGMIS_DigitalCard_Clean_(profile.familyId).toUpperCase();

  if (!familyId) {
    throw new Error('The linked family profile has no Family ID.');
  }

  return {
    user: user,
    profile: profile,
    familyId: familyId,
    familyMembers: KGMIS_DigitalCard_ReadFamilyMembers_(familyId),
    subscriptionYear: subscriptionYear
  };
}

function KGMIS_DigitalCard_BuildPeople_(profile, familyMembers, cards) {
  const issued = {};

  cards.forEach(function (row) {
    issued[KGMIS_DigitalCard_Clean_(row.CARD_ID).toUpperCase()] = row;
  });

  const people = [];

  if (KGMIS_DigitalCard_Clean_(profile.memberName)) {
    people.push(KGMIS_DigitalCard_CreatePerson_({
      key: 'PRIMARY_MEMBER',
      familyId: profile.familyId,
      kefgId: profile.kefgId || profile.memberKefgId || '',
      cardholderType: 'PRIMARY_MEMBER',
      relationSequence: '01',
      cardholderName: profile.memberName,
      mobile: profile.memberMobile,
      email: profile.memberEmail,
      photoFileId: profile.photoFileId || '',
      photoUrl: profile.photoUrl || profile.memberPhotoUrl || '',
      cardEligible: true
    }, issued));
  }

  if (KGMIS_DigitalCard_Clean_(profile.spouseName)) {
    people.push(KGMIS_DigitalCard_CreatePerson_({
      key: 'SPOUSE',
      familyId: profile.familyId,
      kefgId: profile.spouseKefgId || profile.relatedMemberKefgId || '',
      cardholderType: 'SPOUSE',
      relationSequence: '02',
      cardholderName: profile.spouseName,
      mobile: profile.spouseMobile,
      email: profile.spouseEmail,
      photoFileId: profile.spousePhotoFileId || '',
      photoUrl: profile.spousePhotoUrl || '',
      cardEligible: true
    }, issued));
  }

  familyMembers.forEach(function (row) {
    const sequence = KGMIS_DigitalCard_NormaliseSequence_(row.RELATION_SEQUENCE);

    if (!sequence || sequence === '01' || sequence === '02') {
      return;
    }

    const fullName = KGMIS_DigitalCard_Clean_(row.FULL_NAME);

    if (!fullName) {
      return;
    }

    people.push(KGMIS_DigitalCard_CreatePerson_({
      key: 'PERSON:' + KGMIS_DigitalCard_Clean_(row.PERSON_ID),
      familyId: row.FAMILY_ID,
      kefgId: row.RELATED_KEFG_ID || '',
      cardholderType: row.FAMILY_RELATION || 'FAMILY_MEMBER',
      relationSequence: sequence,
      cardholderName: fullName,
      mobile: row.MOBILE || '',
      email: row.EMAIL || '',
      photoFileId: row.PHOTO_FILE_ID || '',
      photoUrl: row.PHOTO_URL || '',
      cardEligible:
        KGMIS_DigitalCard_IsYes_(row.CARD_ELIGIBLE) &&
        (!row.RECORD_STATUS ||
          KGMIS_DigitalCard_Clean_(row.RECORD_STATUS).toUpperCase() === 'ACTIVE')
    }, issued));
  });

  return people.sort(function (a, b) {
    return Number(a.relationSequence) - Number(b.relationSequence);
  });
}

function KGMIS_DigitalCard_CreatePerson_(person, issuedByCardId) {
  const cardId = KGMIS_DigitalCard_BuildCardId_(
    person.familyId,
    person.relationSequence
  );
  const existing = issuedByCardId[cardId] || null;

  return {
    key: person.key,
    cardId: cardId,
    familyId: person.familyId,
    kefgId: person.kefgId || '',
    cardholderType: person.cardholderType,
    relationSequence: person.relationSequence,
    cardholderName: person.cardholderName,
    mobile: person.mobile || '',
    email: person.email || '',
    photoFileId: person.photoFileId || '',
    photoUrl: person.photoUrl || '',
    cardEligible: Boolean(person.cardEligible),
    issued: Boolean(existing),
    cardStatus: existing ? existing.CARD_STATUS || '' : '',
    validUntil: existing ? existing.VALID_UNTIL || '' : '',
    cardPdfUrl: existing ? existing.CARD_PDF_FILE_URL || '' : '',
    cardImageUrl: existing ? existing.CARD_IMAGE_FILE_URL || '' : ''
  };
}

function KGMIS_DigitalCard_FindPersonByKey_(profile, familyMembers, key) {
  const cleanKey = KGMIS_DigitalCard_Clean_(key).toUpperCase();
  return KGMIS_DigitalCard_BuildPeople_(profile, familyMembers, [])
    .find(function (person) {
      return KGMIS_DigitalCard_Clean_(person.key).toUpperCase() === cleanKey;
    }) || null;
}

function KGMIS_DigitalCard_BuildCardId_(familyId, relationSequence) {
  const familyNumber = KGMIS_DigitalCard_ExtractFamilyNumber_(familyId);
  const sequence = KGMIS_DigitalCard_NormaliseSequence_(relationSequence);

  if (!sequence) {
    throw new Error('A valid relation sequence from 01 to 99 is required.');
  }

  return KGMIS_DIGITAL_CARD_CONFIG.CARD_PREFIX + familyNumber + sequence;
}

function KGMIS_DigitalCard_ExtractFamilyNumber_(familyId) {
  const cleaned = KGMIS_DigitalCard_Clean_(familyId).toUpperCase();
  const match = cleaned.match(/^FAM(\d{1,6})$/);

  if (!match) {
    throw new Error('Invalid Family ID: ' + cleaned);
  }

  return String(Number(match[1])).padStart(6, '0');
}

function KGMIS_DigitalCard_NormaliseSequence_(value) {
  const digits = KGMIS_DigitalCard_Clean_(value).replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  const number = Number(digits);

  if (!Number.isInteger(number) || number < 1 || number > 99) {
    return '';
  }

  return String(number).padStart(2, '0');
}

function KGMIS_DigitalCard_GetSheetContext_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    KGMIS_DIGITAL_CARD_CONFIG.MEMBER_CARDS_SHEET
  );

  if (!sheet) {
    throw new Error('KEFG_MEMBER_CARDS was not found.');
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error('KEFG_MEMBER_CARDS has no headers.');
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (header) {
      return KGMIS_DigitalCard_Clean_(header).toUpperCase();
    });

  const missing = KGMIS_DIGITAL_CARD_CONFIG.MEMBER_CARD_HEADERS
    .filter(function (header) {
      return headers.indexOf(header) === -1;
    });

  if (missing.length) {
    throw new Error('KEFG_MEMBER_CARDS is missing headers: ' + missing.join(', '));
  }

  return {
    sheet: sheet,
    headers: headers
  };
}

function KGMIS_DigitalCard_ReadCardsByFamily_(familyId) {
  const context = KGMIS_DigitalCard_GetSheetContext_();
  const lastRow = context.sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const values = context.sheet.getRange(
    2,
    1,
    lastRow - 1,
    context.headers.length
  ).getValues();
  const familyIndex = context.headers.indexOf('FAMILY_ID');

  return values
    .filter(function (row) {
      return KGMIS_DigitalCard_Clean_(row[familyIndex]).toUpperCase() === familyId;
    })
    .map(function (row) {
      return KGMIS_DigitalCard_RowToObject_(row, context.headers);
    });
}

function KGMIS_DigitalCard_FindCardById_(context, cardId) {
  const lastRow = context.sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const cardIdIndex = context.headers.indexOf('CARD_ID');
  const values = context.sheet.getRange(
    2,
    1,
    lastRow - 1,
    context.headers.length
  ).getValues();

  for (let i = 0; i < values.length; i += 1) {
    if (KGMIS_DigitalCard_Clean_(values[i][cardIdIndex]).toUpperCase() === cardId) {
      return {
        rowNumber: i + 2,
        record: KGMIS_DigitalCard_RowToObject_(values[i], context.headers)
      };
    }
  }

  return null;
}

function KGMIS_DigitalCard_UpdateCardRow_(context, rowNumber, updates) {
  const range = context.sheet.getRange(
    rowNumber,
    1,
    1,
    context.headers.length
  );
  const row = range.getValues()[0];

  Object.keys(updates).forEach(function (header) {
    const index = context.headers.indexOf(header);
    if (index !== -1) {
      row[index] = updates[header];
    }
  });

  range.setValues([row]);
}

function KGMIS_DigitalCard_ReadFamilyMembers_(familyId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    KGMIS_DIGITAL_CARD_CONFIG.FAMILY_MEMBERS_SHEET
  );

  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 1) {
    return [];
  }

  const values = sheet.getRange(
    1,
    1,
    sheet.getLastRow(),
    sheet.getLastColumn()
  ).getValues();
  const headers = values[0].map(function (header) {
    return KGMIS_DigitalCard_Clean_(header).toUpperCase();
  });
  const familyIndex = headers.indexOf('FAMILY_ID');

  if (familyIndex === -1) {
    throw new Error('KEFG_FAMILY_MEMBERS is missing FAMILY_ID.');
  }

  return values.slice(1)
    .filter(function (row) {
      return KGMIS_DigitalCard_Clean_(row[familyIndex]).toUpperCase() === familyId;
    })
    .map(function (row) {
      return KGMIS_DigitalCard_RowToObject_(row, headers);
    });
}

function KGMIS_DigitalCard_CreateCardResponse_(row) {
  return {
    cardId: row.CARD_ID || '',
    familyId: row.FAMILY_ID || '',
    kefgId: row.KEFG_ID || '',
    cardholderType: row.CARDHOLDER_TYPE || '',
    relationSequence: row.RELATION_SEQUENCE || '',
    cardholderName: row.CARDHOLDER_NAME || '',
    membershipType: row.MEMBERSHIP_TYPE || '',
    membershipYear: row.MEMBERSHIP_YEAR || '',
    membershipStatus: row.MEMBERSHIP_STATUS || '',
    issueDate: KGMIS_DigitalCard_FormatOutputDate_(row.ISSUE_DATE),
    validUntil: KGMIS_DigitalCard_FormatOutputDate_(row.VALID_UNTIL),
    cardStatus: row.CARD_STATUS || '',
    memberMobile: row.MEMBER_MOBILE || '',
    memberEmail: row.MEMBER_EMAIL || '',
    photoUrl: row.PHOTO_URL || '',
    qrToken: row.QR_TOKEN || '',
    cardPdfUrl: row.CARD_PDF_FILE_URL || '',
    cardImageUrl: row.CARD_IMAGE_FILE_URL || '',
    cardVersion: row.CARD_VERSION || '',
    remarks: row.REMARKS || ''
  };
}

function KGMIS_DigitalCard_CountStatus_(cards, status) {
  return cards.filter(function (row) {
    return KGMIS_DigitalCard_Clean_(row.CARD_STATUS).toUpperCase() === status;
  }).length;
}

function KGMIS_DigitalCard_AssertOwnFamily_(record, familyId) {
  if (KGMIS_DigitalCard_Clean_(record.FAMILY_ID).toUpperCase() !== familyId) {
    throw new Error('You are not authorised to update this card.');
  }
}

function KGMIS_DigitalCard_GetMembershipType_(profile) {
  return profile.membershipType ||
    profile.typeOfMembership ||
    profile.memberCategory ||
    '';
}

function KGMIS_DigitalCard_GetFinancialYearEnd_(membershipYear) {
  const text = KGMIS_DigitalCard_Clean_(membershipYear);
  const match = text.match(/(\d{4})\D+(\d{2,4})/);

  if (!match) {
    throw new Error('Invalid membership year: ' + text);
  }

  const startYear = Number(match[1]);
  const endYear = match[2].length === 2
    ? Number(String(startYear).slice(0, 2) + match[2])
    : Number(match[2]);

  return endYear + '-03-31';
}

function KGMIS_DigitalCard_GenerateQrToken_() {
  return Utilities.getUuid().replace(/-/g, '').toUpperCase();
}

function KGMIS_DigitalCard_IncrementVersion_(value) {
  const current = Number(KGMIS_DigitalCard_Clean_(value) || '1');
  const next = Number.isFinite(current) ? Math.floor(current) + 1 : 2;
  return String(next) + '.0';
}

function KGMIS_DigitalCard_ParseIsoDate_(value) {
  const text = KGMIS_DigitalCard_Clean_(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );

  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null;
  }

  return date;
}

function KGMIS_DigitalCard_FormatDate_(value) {
  return Utilities.formatDate(
    value,
    Session.getScriptTimeZone() || 'Asia/Kolkata',
    'yyyy-MM-dd'
  );
}

function KGMIS_DigitalCard_FormatOutputDate_(value) {
  if (!value) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    return KGMIS_DigitalCard_FormatDate_(value);
  }

  return KGMIS_DigitalCard_Clean_(value);
}

function KGMIS_DigitalCard_IsYes_(value) {
  return ['YES', 'Y', 'TRUE', '1', 'ELIGIBLE'].indexOf(
    KGMIS_DigitalCard_Clean_(value).toUpperCase()
  ) !== -1;
}

function KGMIS_DigitalCard_RowToObject_(row, headers) {
  const record = {};
  headers.forEach(function (header, index) {
    record[header] = row[index];
  });
  return record;
}

function KGMIS_DigitalCard_ObjectToRow_(record, headers) {
  return headers.map(function (header) {
    return Object.prototype.hasOwnProperty.call(record, header)
      ? record[header]
      : '';
  });
}

function KGMIS_DigitalCard_Clean_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim().replace(/\s+/g, ' ');
}

function KGMIS_TestDigitalCardIdGeneration() {
  const tests = [
    ['FAM00035', '01', 'KEFG00003501'],
    ['FAM00128', '02', 'KEFG00012802'],
    ['FAM999999', '99', 'KEFG99999999']
  ];

  const results = tests.map(function (test) {
    const actual = KGMIS_DigitalCard_BuildCardId_(test[0], test[1]);
    return {
      familyId: test[0],
      sequence: test[1],
      expected: test[2],
      actual: actual,
      passed: actual === test[2]
    };
  });

  Logger.log(JSON.stringify(results, null, 2));
  return results;
}

function KGMIS_TestDigitalCardSheet() {
  const context = KGMIS_DigitalCard_GetSheetContext_();
  const result = {
    success: true,
    sheetName: context.sheet.getName(),
    headerCount: context.headers.length,
    lastRow: context.sheet.getLastRow()
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * ============================================================
 * ADMIN PORTAL CARD ISSUANCE
 * ============================================================
 * Called by 37.00_KGMIS_Module_Admin.html
 *
 * @param {string} sessionToken Active KGMIS session token.
 * @param {string} candidateKey Candidate key returned by the Admin search.
 * @return {Object} Flat response expected by the Admin Portal.
 */
function KGMIS_Admin_IssueDigitalCard(sessionToken, candidateKey) {
  const user = KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'APPLICATION',
    'ADMINISTER'
  );

  const cleanCandidateKey = KGMIS_DigitalCard_Clean_(candidateKey);

  if (!cleanCandidateKey) {
    throw new Error('The selected member reference is missing. Please search again.');
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    const candidate = KGMIS_DigitalCard_ResolveAdminCandidate_(
      cleanCandidateKey
    );

    KGMIS_DigitalCard_ValidateAdminCandidate_(candidate);

    const cardId = KGMIS_DigitalCard_BuildCardId_(
      candidate.familyId,
      candidate.relationSequence
    );

    const sheetContext = KGMIS_DigitalCard_GetSheetContext_();
    const existing = KGMIS_DigitalCard_FindCardById_(
      sheetContext,
      cardId
    );

    if (existing) {
      const existingStatus = KGMIS_DigitalCard_Clean_(
        existing.record.CARD_STATUS
      ).toUpperCase();

      if (existingStatus === 'ACTIVE' || existingStatus === 'EXTENDED') {
        throw new Error(
          'An active digital card already exists for this cardholder: ' +
          cardId
        );
      }

      if (existingStatus === 'REVOKED') {
        throw new Error(
          'This card number has been revoked and cannot be issued again: ' +
          cardId
        );
      }

      throw new Error(
        'A digital-card record already exists for this cardholder: ' +
        cardId
      );
    }

    const now = new Date();
    const membershipYear = KGMIS_DigitalCard_Clean_(
    candidate.membershipYear
    );
    
    const financialYearRecord =
    KGMIS_GetFinancialYear(
    membershipYear
     );

    if (
  !financialYearRecord ||
  !financialYearRecord.endDate
) {
  throw new Error(
    'END_DATE is missing for Financial Year ' +
    membershipYear +
    '.'
  );
}
    const rowObject = {
      CARD_ID: cardId,
      FAMILY_ID: candidate.familyId,
      KEFG_ID: candidate.kefgId || '',
      CARDHOLDER_TYPE: KGMIS_DigitalCard_ResolveOfficialCardholderType_(candidate),
      RELATION_SEQUENCE: candidate.relationSequence,
      CARDHOLDER_NAME: candidate.name,
      MEMBERSHIP_TYPE: candidate.membershipType || '',
      MEMBERSHIP_YEAR: membershipYear,
      MEMBERSHIP_STATUS: candidate.membershipStatus || '',
      ISSUE_DATE: KGMIS_DigitalCard_FormatDate_(now),
      VALID_UNTIL: KGMIS_DigitalCard_FormatDate_(financialYearRecord.gracePeriodEnd || financialYearRecord.endDate),
      CARD_STATUS: 'ACTIVE',
      MEMBER_MOBILE: candidate.phone || '',
      MEMBER_EMAIL: candidate.email || '',
      PHOTO_FILE_ID: candidate.photoFileId || '',
      PHOTO_URL: candidate.photoUrl || '',
      QR_TOKEN: KGMIS_DigitalCard_GenerateQrToken_(),
      CARD_PDF_FILE_ID: '',
      CARD_PDF_FILE_URL: '',
      CARD_IMAGE_FILE_ID: '',
      CARD_IMAGE_FILE_URL: '',
      CREATED_ON: now,
      CREATED_BY: user.email || 'SYSTEM',
      UPDATED_ON: now,
      UPDATED_BY: user.email || 'SYSTEM',
      CARD_VERSION: KGMIS_DIGITAL_CARD_CONFIG.CARD_VERSION,
      REMARKS: 'Issued through Administration Portal'
    };

    sheetContext.sheet.appendRow(
      KGMIS_DigitalCard_ObjectToRow_(
        rowObject,
        sheetContext.headers
      )
    );

    return {
      success: true,
      message: 'Digital Membership Card issued successfully.',
      cardId: rowObject.CARD_ID,
      familyId: rowObject.FAMILY_ID,
      kefgId: rowObject.KEFG_ID,
      cardholderName: rowObject.CARDHOLDER_NAME,
      cardholderType: rowObject.CARDHOLDER_TYPE,
      relationSequence: rowObject.RELATION_SEQUENCE,
      membershipType: rowObject.MEMBERSHIP_TYPE,
      membershipYear: rowObject.MEMBERSHIP_YEAR,
      membershipStatus: rowObject.MEMBERSHIP_STATUS,
      issueDate: rowObject.ISSUE_DATE,
      validUntil: rowObject.VALID_UNTIL,
      cardStatus: rowObject.CARD_STATUS,
      qrToken: rowObject.QR_TOKEN,
      cardVersion: rowObject.CARD_VERSION,
      cardImageUrl: '',
      cardPdfUrl: ''
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

/**
 * Resolves the exact candidate selected in the Admin Portal.
 * This deliberately reuses the Admin search-module candidate builders so
 * issuance follows exactly the same identity and duplicate-merging rules.
 */
function KGMIS_DigitalCard_ResolveAdminCandidate_(candidateKey) {
  KGMIS_DigitalCard_AssertAdminHelpersAvailable_();

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const candidates = [];

  const masterRows = KGMIS_Admin_ReadSheetObjects_(
    spreadsheet,
    KGMIS_ADMIN_CARD_SEARCH_CONFIG.MASTER_SHEET,
    true
  );

  const familyMemberRows = KGMIS_Admin_ReadSheetObjects_(
    spreadsheet,
    KGMIS_ADMIN_CARD_SEARCH_CONFIG.FAMILY_MEMBERS_SHEET,
    false
  );

  KGMIS_Admin_AddMasterCandidates_(candidates, masterRows);
  KGMIS_Admin_AddFamilyMemberCandidates_(candidates, familyMemberRows);

  const mergedCandidates =
    KGMIS_Admin_MergeDuplicateCandidates_(candidates);

  KGMIS_Admin_AttachCurrentMembershipYear_(mergedCandidates);

  const normalisedRequestedKey =
    KGMIS_DigitalCard_Clean_(candidateKey).toUpperCase();

  const candidate = mergedCandidates.find(function (item) {
    return (
      KGMIS_DigitalCard_Clean_(item.candidateKey).toUpperCase() ===
      normalisedRequestedKey
    );
  });

  if (!candidate) {
    throw new Error(
      'The selected member could not be resolved. Please search again.'
    );
  }

  return candidate;
}

/**
 * Validates all information required to create a card record.
 */
function KGMIS_DigitalCard_ValidateAdminCandidate_(candidate) {
  if (!candidate) {
    throw new Error('The selected member could not be found.');
  }

  if (!candidate.cardEligible) {
    throw new Error(
      'The selected person is not eligible for a digital membership card.'
    );
  }

  if (!KGMIS_DigitalCard_Clean_(candidate.familyId)) {
    throw new Error('The selected person has no Family ID.');
  }

  if (!KGMIS_DigitalCard_Clean_(candidate.name)) {
    throw new Error('The selected person has no cardholder name.');
  }

  if (!KGMIS_DigitalCard_NormaliseSequence_(candidate.relationSequence)) {
    throw new Error(
      'The selected person has no valid relation sequence.'
    );
  }

  if (!candidate.membershipYearRecordFound) {
    throw new Error(
      'No active membership-year record was found for this family.'
    );
  }

  if (!KGMIS_DigitalCard_Clean_(candidate.membershipYear)) {
    throw new Error('The current membership year is missing.');
  }

  const recordStatus = KGMIS_DigitalCard_Clean_(
    candidate.recordStatus
  ).toUpperCase();

  if (recordStatus && recordStatus !== 'ACTIVE') {
    throw new Error('The selected member record is not active.');
  }
}

/**
 * ============================================================
 * RESOLVE OFFICIAL CARDHOLDER TYPE
 * ============================================================
 *
 * Official internal values stored in KEFG_MEMBER_CARDS:
 *
 * PRIMARY_MEMBER
 * DEPENDENT
 *
 * Card display:
 *
 * PRIMARY_MEMBER -> Primary Member
 * DEPENDENT      -> Family Member
 */
function KGMIS_DigitalCard_ResolveOfficialCardholderType_(
  candidate
) {

  if (!candidate) {
    throw new Error(
      'Candidate object required.'
    );
  }

  const rawValues = [
    candidate.cardholderType,
    candidate.memberCategory,
    candidate.familyRelation,
    candidate.dependantType,
    candidate.dependentType
  ]
    .map(function (value) {
      return KGMIS_DigitalCard_Clean_(
        value
      )
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    })
    .filter(Boolean);

  const dependentValues = [
    'DEPENDENT',
    'DEPENDANT',
    'FAMILY_MEMBER',
    'CHILD',
    'CHILD1',
    'CHILD2',
    'CHILD3',
    'CHILD_1',
    'CHILD_2',
    'CHILD_3',
    'PARENT',
    'FATHER',
    'MOTHER',
    'FATHER_IN_LAW',
    'MOTHER_IN_LAW',
    'IN_LAW'
  ];

  const isDependent =
    rawValues.some(function (value) {
      return dependentValues.indexOf(value) !== -1;
    });

  if (isDependent) {
    return 'DEPENDENT';
  }

  const primaryMemberValues = [
    'PRIMARY_MEMBER',
    'PRIMARY',
    'MEMBER',
    'SPOUSE',
    'ALUMNI_SPOUSE',
    'ALUMNI_SPOUSE_MEMBER',
    'NON_ALUMNI_SPOUSE',
    'NON_ALUMNI_SPOUSE_MEMBER'
  ];

  const isPrimaryMember =
    rawValues.some(function (value) {
      return primaryMemberValues.indexOf(value) !== -1;
    });

  if (isPrimaryMember) {
    return 'PRIMARY_MEMBER';
  }

  throw new Error(
    'Unable to determine the official CARDHOLDER_TYPE for ' +
    (
      candidate.name ||
      'the selected person'
    ) +
    '. Received values: ' +
    (
      rawValues.join(', ') ||
      'none'
    )
  );
}

/**
 * Confirms that the Admin search module is installed in the same Apps Script
 * project. Clear errors are better than a silent "Issuing..." state.
 */
function KGMIS_DigitalCard_AssertAdminHelpersAvailable_() {
  const requiredFunctions = [
    'KGMIS_Admin_ReadSheetObjects_',
    'KGMIS_Admin_AddMasterCandidates_',
    'KGMIS_Admin_AddFamilyMemberCandidates_',
    'KGMIS_Admin_MergeDuplicateCandidates_',
    'KGMIS_Admin_AttachCurrentMembershipYear_'
  ];

  const missingFunctions = requiredFunctions.filter(function (name) {
    return typeof globalThis[name] !== 'function';
  });

  if (typeof KGMIS_ADMIN_CARD_SEARCH_CONFIG === 'undefined') {
    missingFunctions.push('KGMIS_ADMIN_CARD_SEARCH_CONFIG');
  }

  if (missingFunctions.length) {
    throw new Error(
      'The Administration card-search module is incomplete. Missing: ' +
      missingFunctions.join(', ')
    );
  }
}

/**
 * Optional test helper. Run from the Apps Script editor with valid values.
 */
function KGMIS_TestAdminIssueDigitalCard_(sessionToken, candidateKey) {
  const result = KGMIS_Admin_IssueDigitalCard(
    sessionToken,
    candidateKey
  );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


/**
 * ============================================================
 * ADMIN: RENDER DIGITAL CARD PREVIEW
 * ============================================================
 *
 * Allows an authorised administrator to preview any issued card.
 *
 * @param {string} sessionToken
 * @param {string} cardId
 * @return {Object}
 */
function KGMIS_Admin_RenderDigitalCardPreview(
  sessionToken,
  cardId
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'APPLICATION',
    'ADMINISTER'
  );

  const cleanCardId =
    KGMIS_DigitalCard_Clean_(
      cardId
    ).toUpperCase();

  if (!cleanCardId) {
    throw new Error(
      'Card ID is required.'
    );
  }

  const card =
    KGMIS_DigitalCardRenderer_ReadCardById_(
      cleanCardId
    );

  if (!card) {
    throw new Error(
      'Digital card not found: ' +
      cleanCardId
    );
  }

  const viewModel =
    KGMIS_DigitalCardRenderer_BuildCardViewModel_({
      card:
        card
    });

  const html =
    KGMIS_DigitalCardRenderer_RenderTemplate_(
      viewModel
    );

  return {
    success:
      true,

    cardId:
      cleanCardId,

    html:
      html
  };
}


/**
 * ============================================================
 * TEST: ADMIN DIGITAL CARD PREVIEW
 * ============================================================
 *
 * Reads one existing card, builds the final View Model,
 * injects it directly into the HTML template and displays
 * the rendered card in a Spreadsheet modal.
 *
 * No sheet data is modified.
 */
function KGMIS_TestAdminCardPreview() {

  const cardId =
    'KEFG00003501';

  // ----------------------------------------------------------
  // STEP 1: READ CARD RECORD
  // ----------------------------------------------------------

  const card =
    KGMIS_DigitalCardRenderer_ReadCardById_(
      cardId
    );

  if (!card) {
    throw new Error(
      'Test card not found: ' +
      cardId
    );
  }

  Logger.log(
    'RAW CARD RECORD:\n' +
    JSON.stringify(
      card,
      null,
      2
    )
  );

  // ----------------------------------------------------------
  // STEP 2: BUILD FINAL VIEW MODEL
  // ----------------------------------------------------------

  const viewModel =
    KGMIS_DigitalCardRenderer_BuildCardViewModel_({
      card: card
    });

  if (!viewModel) {
    throw new Error(
      'The Digital Card View Model could not be created.'
    );
  }

  Logger.log(
    'FINAL CARD VIEW MODEL:\n' +
    JSON.stringify(
      viewModel,
      null,
      2
    )
  );

  // ----------------------------------------------------------
  // STEP 3: LOAD HTML TEMPLATE
  // ----------------------------------------------------------

  const template =
    HtmlService.createTemplateFromFile(
      KGMIS_DIGITAL_CARD_RENDERER_CONFIG
        .TEMPLATE_FILE
    );

  // The HTML template expects a variable named "card".
  template.card =
    viewModel;

  // ----------------------------------------------------------
  // STEP 4: EVALUATE HTML
  // ----------------------------------------------------------

  const htmlOutput =
    template
      .evaluate()
      .setTitle(
        'KEF Global Digital Membership Card'
      )
      .setWidth(
        1100
      )
      .setHeight(
        760
      );

  const htmlContent =
    htmlOutput.getContent();

  if (!htmlContent) {
    throw new Error(
      'The rendered Digital Card HTML is blank.'
    );
  }

  Logger.log(
    'RENDERED HTML LENGTH: ' +
    htmlContent.length
  );

  // ----------------------------------------------------------
  // STEP 5: DISPLAY DIRECTLY IN SPREADSHEET
  // ----------------------------------------------------------
  //
  // ### Following part deleted for testing
  // SpreadsheetApp
  //  .getUi()
  //  .showModalDialog(
  //  htmlOutput,
  //  'KEF Global Digital Membership Card'
  //);
  //

return {
  success: true,
  cardId: cardId,
  cardholderName:
    viewModel.cardholderName || '',
  htmlLength:
    htmlContent.length,
  html:
    htmlContent,
  message:
    'Digital Card HTML rendered successfully.'
};

}

  // -----------------------------------------------------------------------
  // STEP 6: DISPLAY CARD DIRECTLY IN BROWSER
  //  USE FOLLOWING AT THE END OF YOUR_WEB_APP_URL?module=digital-card-test
  // ------------------------------------------------------------------------
  //

function KGMIS_TestAdminCardPreviewHtml() {

  const cardId =
    'KEFG00003501';

  const card =
    KGMIS_DigitalCardRenderer_ReadCardById_(
      cardId
    );

  if (!card) {
    throw new Error(
      'Test card not found: ' +
      cardId
    );
  }

  const viewModel =
    KGMIS_DigitalCardRenderer_BuildCardViewModel_({
      card: card
    });

  const template =
    HtmlService.createTemplateFromFile(
      KGMIS_DIGITAL_CARD_RENDERER_CONFIG
        .TEMPLATE_FILE
    );

  template.card =
    viewModel;

  return template
    .evaluate()
    .setTitle(
      'KEF Global Digital Membership Card'
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.ALLOWALL
    );
}



