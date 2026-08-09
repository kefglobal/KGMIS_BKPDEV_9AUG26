// 36.09_KGMIS_Module_Admin.gs — PART 1 OF 3
// Paste the three parts consecutively into the same Apps Script file.

/**
 * KGMIS Administration Module
 * File: 36.09_KGMIS_Module_Admin.gs
 */

const KGMIS_ADMIN_CARD_SEARCH_CONFIG = Object.freeze({
  MASTER_SHEET: 'KGMIS_MASTER_DATABASE_v1.0',
  FAMILY_MEMBERS_SHEET: 'KEFG_FAMILY_MEMBERS',
  MAX_RESULTS: 100,
  ALUMNI_ASSOCIATIONS: Object.freeze([
    'AECK', 'CETA', 'KEA', 'MACE', 'NIT', 'NSSCE', 'TEC', 'TKMCE'
  ])
});

function KGMIS_RenderAdminModule_() {
  return HtmlService
    .createTemplateFromFile('37.00_KGMIS_Module_Admin')
    .evaluate()
    .setTitle('Administration')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function KGMIS_Admin_SearchDigitalCardCandidates(sessionToken, searchText) {
  const user = KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'APPLICATION',
    'ADMINISTER'
  );

  const query = KGMIS_Admin_CleanText_(searchText);

  if (!query) {
    throw new Error(
      'Enter a KEFG ID, Family ID, Card Number, Name, Mobile Number or Email Address.'
    );
  }

  if (query.length < 2) {
    throw new Error('Enter at least two characters to search.');
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

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

  const cardRows = KGMIS_ReadAllCards_() || [];
  const candidates = [];

  KGMIS_Admin_AddMasterCandidates_(candidates, masterRows);
  KGMIS_Admin_AddFamilyMemberCandidates_(candidates, familyMemberRows);

  const mergedCandidates =
    KGMIS_Admin_MergeDuplicateCandidates_(candidates);

  KGMIS_Admin_AttachCurrentMembershipYear_(mergedCandidates);
  KGMIS_Admin_AttachCardRecords_(mergedCandidates, cardRows);

  const directMatches =
  mergedCandidates.filter(function (candidate) {
    return KGMIS_Admin_CandidateMatchesSearch_(
      candidate,
      query
    );
  });

const matchedFamilyIds = {};

directMatches.forEach(function (candidate) {
  const familyId =
    KGMIS_Admin_NormaliseId_(
      candidate.familyId
    );

  if (familyId) {
    matchedFamilyIds[familyId] = true;
  }
});

let results =
  mergedCandidates.filter(function (candidate) {
    const familyId =
      KGMIS_Admin_NormaliseId_(
        candidate.familyId
      );

    return (
      directMatches.indexOf(candidate) !== -1 ||
      Boolean(
        familyId &&
        matchedFamilyIds[familyId]
      )
    );
  });

  KGMIS_Admin_AddCardOnlyResults_(
    results,
    mergedCandidates,
    cardRows,
    query
  );

  results = KGMIS_Admin_MergeDuplicateCandidates_(results);
  KGMIS_Admin_AttachCurrentMembershipYear_(results);
  results.sort(KGMIS_Admin_SortSearchResults_);

  const limitedResults = results.slice(
    0,
    KGMIS_ADMIN_CARD_SEARCH_CONFIG.MAX_RESULTS
  );

  return {
    success: true,
    searchText: query,
    count: limitedResults.length,
    totalMatches: results.length,
    truncated:
      results.length > KGMIS_ADMIN_CARD_SEARCH_CONFIG.MAX_RESULTS,
    searchedBy: {
      email: user.email || '',
      userName: user.userName || '',
      role: user.role || ''
    },
    results: limitedResults.map(KGMIS_Admin_CreateSearchResponse_)
  };
}

function KGMIS_Admin_AddMasterCandidates_(candidates, rows) {
  candidates = Array.isArray(candidates) ? candidates : [];
  rows = Array.isArray(rows) ? rows : [];

  rows.forEach(function (row) {
    const familyId =
      KGMIS_Admin_GetValue_(row, ['FAMILY_ID']);

    const memberName =
      KGMIS_Admin_GetValue_(row, ['MEMBER_NAME', 'FULL_NAME', 'NAME']);

    const memberCategory =
      KGMIS_Admin_GetValue_(row, ['MEMBER_CATEGORY']);

    const recordStatus =
      KGMIS_Admin_GetValue_(row, ['RECORD_STATUS']);

    if (
      memberName &&
      KGMIS_Admin_IsRecordActive_(recordStatus)
    ) {
      const kefgId =
        KGMIS_Admin_GetValue_(row, ['KEFG_ID']);

      candidates.push({
        source: 'MASTER',
        sourceRowNumber: row.__ROW_NUMBER__ || '',
        candidateKey: KGMIS_Admin_CreateCandidateKey_(
          kefgId,
          familyId,
          memberName,
          ''
        ),
        personKey: 'MASTER:' + (kefgId || familyId + ':' + memberName),
        familyId: familyId,
        kefgId: kefgId,
        personId: '',
        relatedKefgId: KGMIS_Admin_GetValue_(
          row,
          ['RELATED_MEMBER_KEFG_ID', 'RELATED_KEFG_ID']
        ),
        relationSequence:
          KGMIS_Admin_GetMasterRelationSequence_(memberCategory),
        name: memberName,
        cardholderType:
          KGMIS_Admin_MapCardholderType_(memberCategory),
        memberCategory: memberCategory,
        familyRelation:
          KGMIS_Admin_DisplayCategory_(memberCategory),
        phone: KGMIS_Admin_GetValue_(
          row,
          ['MEMBER_MOBILE', 'MOBILE', 'PHONE']
        ),
        whatsapp: KGMIS_Admin_GetValue_(
          row,
          ['MEMBER_WHATSAPP', 'WHATSAPP']
        ),
        email: KGMIS_Admin_GetValue_(
          row,
          ['MEMBER_EMAIL', 'EMAIL']
        ),
        membershipType: '',
        membershipYear: '',
        membershipStatus: '',
        paymentStatus: '',
        membershipYearRecordFound: false,
        alumniAssociation:
          KGMIS_Admin_GetValue_(row, ['ALUMNI_ASSOCIATION']),
        photoFileId: KGMIS_Admin_GetValue_(
          row,
          ['PHOTO_FILE_ID', 'MEMBER_PHOTO_FILE_ID']
        ),
        photoUrl: KGMIS_Admin_GetValue_(
          row,
          ['PHOTO_URL', 'MEMBER_PHOTO_URL', 'PHOTO']
        ),
        recordStatus: recordStatus || 'ACTIVE',
        cardEligible: true,
        cardIssued: false,
        cardId: '',
        cardStatus: '',
        issueDate: '',
        validUntil: '',
        cardVersion: '',
        cardImageUrl: '',
        cardPdfUrl: '',
        qrToken: ''
      });
    }

    if (
      KGMIS_Admin_ShouldCreateEmbeddedSpouse_(
        row,
        memberCategory
      )
    ) {
      const spouseName =
        KGMIS_Admin_GetValue_(row, ['SPOUSE_NAME']);

      const spouseKefgId = KGMIS_Admin_GetValue_(
        row,
        [
          'SPOUSE_KEFG_ID',
          'RELATED_MEMBER_KEFG_ID',
          'RELATED_KEFG_ID'
        ]
      );

      const spouseAssociation = KGMIS_Admin_GetValue_(
        row,
        ['SPOUSE_ALUMNI_ASSOCIATION']
      );

      const spouseType =
        KGMIS_Admin_IsAlumniSpouse_(
          spouseKefgId,
          spouseAssociation
        )
          ? 'PRIMARY MEMBER'
          : 'MEMBER';

      candidates.push({
        source: 'MASTER_SPOUSE',
        sourceRowNumber: row.__ROW_NUMBER__ || '',
        candidateKey: KGMIS_Admin_CreateCandidateKey_(
          spouseKefgId,
          familyId,
          spouseName,
          ''
        ),
        personKey:
          'SPOUSE:' +
          (spouseKefgId || familyId + ':' + spouseName),
        familyId: familyId,
        kefgId: spouseKefgId,
        personId: '',
        relatedKefgId:
          KGMIS_Admin_GetValue_(row, ['KEFG_ID']),
        relationSequence: '02',
        name: spouseName,
        cardholderType: spouseType,
        memberCategory:
          spouseType === 'PRIMARY MEMBER'
            ? 'ALUMNI SPOUSE MEMBER'
            : 'NON-ALUMNI SPOUSE',
        familyRelation: 'Spouse',
        phone: KGMIS_Admin_GetValue_(
          row,
          ['SPOUSE_MOBILE', 'SPOUSE_PHONE']
        ),
        whatsapp:
          KGMIS_Admin_GetValue_(row, ['SPOUSE_WHATSAPP']),
        email:
          KGMIS_Admin_GetValue_(row, ['SPOUSE_EMAIL']),
        membershipType: '',
        membershipYear: '',
        membershipStatus: '',
        paymentStatus: '',
        membershipYearRecordFound: false,
        alumniAssociation: spouseAssociation,
        photoFileId:
          KGMIS_Admin_GetValue_(row, ['SPOUSE_PHOTO_FILE_ID']),
        photoUrl:
          KGMIS_Admin_GetValue_(row, ['SPOUSE_PHOTO_URL']),
        recordStatus: 'ACTIVE',
        cardEligible: true,
        cardIssued: false,
        cardId: '',
        cardStatus: '',
        issueDate: '',
        validUntil: '',
        cardVersion: '',
        cardImageUrl: '',
        cardPdfUrl: '',
        qrToken: ''
      });
    }
  });
}

function KGMIS_Admin_AddFamilyMemberCandidates_(candidates, rows) {
  candidates = Array.isArray(candidates) ? candidates : [];
  rows = Array.isArray(rows) ? rows : [];

  rows.forEach(function (row) {
    const recordStatus =
      KGMIS_Admin_GetValue_(row, ['RECORD_STATUS']);

    if (!KGMIS_Admin_IsRecordActive_(recordStatus)) {
      return;
    }

    const name = KGMIS_Admin_GetValue_(
      row,
      ['FULL_NAME', 'MEMBER_NAME', 'NAME']
    );

    if (!name) {
      return;
    }

    const familyId =
      KGMIS_Admin_GetValue_(row, ['FAMILY_ID']);

    const personId =
      KGMIS_Admin_GetValue_(row, ['PERSON_ID']);

    const relatedKefgId = KGMIS_Admin_GetValue_(
      row,
      ['RELATED_KEFG_ID', 'RELATED_MEMBER_KEFG_ID']
    );

    const relation = KGMIS_Admin_GetValue_(
      row,
      ['FAMILY_RELATION', 'RELATION']
    );

    const cardEligibleValue =
      KGMIS_Admin_GetValue_(row, ['CARD_ELIGIBLE']);

    candidates.push({
      source: 'FAMILY_MEMBER',
      sourceRowNumber: row.__ROW_NUMBER__ || '',
      candidateKey: KGMIS_Admin_CreateCandidateKey_(
        relatedKefgId,
        familyId,
        name,
        personId
      ),
      personKey:
        'PERSON:' + (personId || familyId + ':' + name),
      familyId: familyId,
      kefgId: relatedKefgId,
      personId: personId,
      relatedKefgId: relatedKefgId,
      relationSequence: KGMIS_Admin_NormaliseSequence_(
        KGMIS_Admin_GetValue_(row, ['RELATION_SEQUENCE'])
      ),
      name: name,
      cardholderType: 'DEPENDENT',
      memberCategory: 'DEPENDANT',
      familyRelation:
        KGMIS_Admin_DisplayCategory_(relation || 'DEPENDANT'),
      phone:
        KGMIS_Admin_GetValue_(row, ['MOBILE', 'MEMBER_MOBILE']),
      whatsapp:
        KGMIS_Admin_GetValue_(row, ['WHATSAPP', 'MEMBER_WHATSAPP']),
      email:
        KGMIS_Admin_GetValue_(row, ['EMAIL', 'MEMBER_EMAIL']),
      membershipType: '',
      membershipYear: '',
      membershipStatus: '',
      paymentStatus: '',
      membershipYearRecordFound: false,
      alumniAssociation:
        KGMIS_Admin_GetValue_(row, ['ALUMNI_ASSOCIATION']),
      photoFileId:
        KGMIS_Admin_GetValue_(row, ['PHOTO_FILE_ID']),
      photoUrl:
        KGMIS_Admin_GetValue_(row, ['PHOTO_URL']),
      recordStatus: recordStatus || 'ACTIVE',
      cardEligible: cardEligibleValue
        ? KGMIS_Admin_IsYes_(cardEligibleValue)
        : true,
      cardIssued: false,
      cardId: '',
      cardStatus: '',
      issueDate: '',
      validUntil: '',
      cardVersion: '',
      cardImageUrl: '',
      cardPdfUrl: '',
      qrToken: ''
    });
  });
}

function KGMIS_Admin_AttachCurrentMembershipYear_(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return;
  }

  const currentYear =
    KGMIS_GetCurrentFinancialYear().financialYear;

  if (!currentYear) {
    throw new Error('The current financial year is not configured.');
  }

  const context = KGMIS_GetMembershipYearContext_();

  if (
    !context ||
    !Array.isArray(context.values) ||
    !context.column
  ) {
    throw new Error('Membership-year context is invalid.');
  }

  const membershipByFamily = {};

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex += 1
  ) {
    const row = context.values[rowIndex];

    const familyId =
      KGMIS_MembershipYearCleanValue_(
        row[context.column.FAMILY_ID]
      ).toUpperCase();

    const financialYear =
      KGMIS_MembershipYearCleanValue_(
        row[context.column.FINANCIAL_YEAR]
      );

    const recordStatus =
      KGMIS_MembershipYearCleanValue_(
        row[context.column.RECORD_STATUS]
      ).toUpperCase();

    if (
      !familyId ||
      financialYear !== currentYear ||
      recordStatus !== 'ACTIVE'
    ) {
      continue;
    }

    if (membershipByFamily[familyId]) {
      throw new Error(
        'Multiple ACTIVE membership-year records were found for ' +
        familyId +
        ' and ' +
        currentYear +
        '.'
      );
    }

    membershipByFamily[familyId] =
      KGMIS_CreateMembershipYearObject_(
        row,
        context.column,
        rowIndex + 1
      );
  }

  candidates.forEach(function (candidate) {
    const familyId =
      KGMIS_Admin_NormaliseId_(candidate.familyId);

    candidate.membershipYear = currentYear;

    const membership = membershipByFamily[familyId];

    if (!membership) {
      candidate.membershipType = '';
      candidate.membershipStatus = '';
      candidate.paymentStatus = '';
      candidate.membershipYearRecordFound = false;
      candidate.membershipYearKey = '';
      candidate.amountDue = 0;
      candidate.amountReceived = 0;
      candidate.outstandingDues = 0;
      return;
    }

    candidate.membershipType =
      membership.membershipType || '';

    candidate.membershipStatus =
      membership.membershipStatus || '';

    candidate.paymentStatus =
      membership.paymentStatus || '';

    candidate.membershipYearRecordFound = true;
    candidate.membershipYearKey =
      membership.membershipYearKey || '';
    candidate.amountDue =
      Number(membership.amountDue || 0);
    candidate.amountReceived =
      Number(membership.amountReceived || 0);
    candidate.outstandingDues =
      Number(membership.outstandingDues || 0);
  });
}

// 36.09_KGMIS_Module_Admin.gs — PART 2 OF 3
// Paste the three parts consecutively into the same Apps Script file.

function KGMIS_Admin_AttachCardRecords_(candidates, cardRows) {
  candidates = Array.isArray(candidates) ? candidates : [];
  cardRows = Array.isArray(cardRows) ? cardRows : [];

  candidates.forEach(function (candidate) {
    const matches = cardRows.filter(function (card) {
      return KGMIS_Admin_CardBelongsToCandidate_(
        card,
        candidate
      );
    });

    if (!matches.length) {
      return;
    }

    matches.sort(KGMIS_Admin_SortCardRecords_);
    const card = matches[0];

    candidate.cardIssued = true;
    candidate.cardId =
      KGMIS_Admin_GetRecordValue_(card, ['CARD_ID']);
    candidate.cardStatus =
      KGMIS_Admin_GetRecordValue_(card, ['CARD_STATUS']);
    candidate.issueDate = KGMIS_Admin_FormatOutputDate_(
      KGMIS_Admin_GetRecordRawValue_(card, ['ISSUE_DATE'])
    );
    candidate.validUntil = KGMIS_Admin_FormatOutputDate_(
      KGMIS_Admin_GetRecordRawValue_(card, ['VALID_UNTIL'])
    );
    candidate.cardVersion =
      KGMIS_Admin_GetRecordValue_(card, ['CARD_VERSION']);
    candidate.cardImageUrl =
      KGMIS_Admin_GetRecordValue_(
        card,
        ['CARD_IMAGE_FILE_URL', 'CARD_IMAGE_URL']
      );
    candidate.cardPdfUrl =
      KGMIS_Admin_GetRecordValue_(
        card,
        ['CARD_PDF_FILE_URL', 'CARD_PDF_URL']
      );
    candidate.qrToken =
      KGMIS_Admin_GetRecordValue_(card, ['QR_TOKEN']);
  });
}

function KGMIS_Admin_CardBelongsToCandidate_(card, candidate) {
  const cardKefgId = KGMIS_Admin_NormaliseId_(
    KGMIS_Admin_GetRecordValue_(card, ['KEFG_ID'])
  );

  const candidateKefgId =
    KGMIS_Admin_NormaliseId_(candidate.kefgId);

  if (
    cardKefgId &&
    candidateKefgId &&
    cardKefgId === candidateKefgId
  ) {
    return true;
  }

  const cardFamilyId = KGMIS_Admin_NormaliseId_(
    KGMIS_Admin_GetRecordValue_(card, ['FAMILY_ID'])
  );

  const candidateFamilyId =
    KGMIS_Admin_NormaliseId_(candidate.familyId);

  if (
    !cardFamilyId ||
    !candidateFamilyId ||
    cardFamilyId !== candidateFamilyId
  ) {
    return false;
  }

  const cardName = KGMIS_Admin_NormaliseText_(
    KGMIS_Admin_GetRecordValue_(card, ['CARDHOLDER_NAME'])
  );

  const candidateName =
    KGMIS_Admin_NormaliseText_(candidate.name);

  if (
    cardName &&
    candidateName &&
    cardName === candidateName
  ) {
    return true;
  }

  const cardSequence = KGMIS_Admin_NormaliseSequence_(
    KGMIS_Admin_GetRecordValue_(card, ['RELATION_SEQUENCE'])
  );

  const candidateSequence =
    KGMIS_Admin_NormaliseSequence_(candidate.relationSequence);

  return Boolean(
    cardSequence &&
    candidateSequence &&
    cardSequence === candidateSequence
  );
}

function KGMIS_Admin_AddCardOnlyResults_(
  results,
  allCandidates,
  cardRows,
  query
) {
  results = Array.isArray(results) ? results : [];
  allCandidates = Array.isArray(allCandidates) ? allCandidates : [];
  cardRows = Array.isArray(cardRows) ? cardRows : [];

  cardRows.forEach(function (card) {
    if (!KGMIS_Admin_CardRowMatchesSearch_(card, query)) {
      return;
    }

    const alreadyRepresented =
      allCandidates.some(function (candidate) {
        return KGMIS_Admin_CardBelongsToCandidate_(
          card,
          candidate
        );
      });

    if (alreadyRepresented) {
      return;
    }

    const cardId =
      KGMIS_Admin_GetRecordValue_(card, ['CARD_ID']);

    results.push({
      source: 'CARD',
      sourceRowNumber: '',
      candidateKey: 'CARD:' + cardId,
      personKey: 'CARD:' + cardId,
      familyId:
        KGMIS_Admin_GetRecordValue_(card, ['FAMILY_ID']),
      kefgId:
        KGMIS_Admin_GetRecordValue_(card, ['KEFG_ID']),
      personId: '',
      relatedKefgId: '',
      relationSequence: KGMIS_Admin_NormaliseSequence_(
        KGMIS_Admin_GetRecordValue_(
          card,
          ['RELATION_SEQUENCE']
        )
      ),
      name:
        KGMIS_Admin_GetRecordValue_(card, ['CARDHOLDER_NAME']),
      cardholderType:
        KGMIS_Admin_GetRecordValue_(card, ['CARDHOLDER_TYPE']),
      memberCategory: '',
      familyRelation: KGMIS_Admin_DisplayCategory_(
        KGMIS_Admin_GetRecordValue_(card, ['CARDHOLDER_TYPE'])
      ),
      phone:
        KGMIS_Admin_GetRecordValue_(card, ['MEMBER_MOBILE']),
      whatsapp: '',
      email:
        KGMIS_Admin_GetRecordValue_(card, ['MEMBER_EMAIL']),
      membershipType: '',
      membershipYear: '',
      membershipStatus: '',
      paymentStatus: '',
      membershipYearRecordFound: false,
      alumniAssociation: '',
      photoFileId:
        KGMIS_Admin_GetRecordValue_(card, ['PHOTO_FILE_ID']),
      photoUrl:
        KGMIS_Admin_GetRecordValue_(card, ['PHOTO_URL']),
      recordStatus: 'ACTIVE',
      cardEligible: false,
      cardIssued: true,
      cardId: cardId,
      cardStatus:
        KGMIS_Admin_GetRecordValue_(card, ['CARD_STATUS']),
      issueDate: KGMIS_Admin_FormatOutputDate_(
        KGMIS_Admin_GetRecordRawValue_(card, ['ISSUE_DATE'])
      ),
      validUntil: KGMIS_Admin_FormatOutputDate_(
        KGMIS_Admin_GetRecordRawValue_(card, ['VALID_UNTIL'])
      ),
      cardVersion:
        KGMIS_Admin_GetRecordValue_(card, ['CARD_VERSION']),
      cardImageUrl:
        KGMIS_Admin_GetRecordValue_(
          card,
          ['CARD_IMAGE_FILE_URL', 'CARD_IMAGE_URL']
        ),
      cardPdfUrl:
        KGMIS_Admin_GetRecordValue_(
          card,
          ['CARD_PDF_FILE_URL', 'CARD_PDF_URL']
        ),
      qrToken:
        KGMIS_Admin_GetRecordValue_(card, ['QR_TOKEN'])
    });
  });
}

function KGMIS_Admin_CandidateMatchesSearch_(candidate, searchText) {
  const query =
    KGMIS_Admin_NormaliseText_(searchText);

  const queryId =
    KGMIS_Admin_NormaliseId_(searchText);

  const queryPhone =
    KGMIS_Admin_NormalisePhone_(searchText);

  const textValues = [
    candidate.name,
    candidate.email,
    candidate.cardholderType,
    candidate.memberCategory,
    candidate.familyRelation,
    candidate.membershipType,
    candidate.membershipStatus,
    candidate.paymentStatus,
    candidate.cardStatus
  ];

  const idValues = [
    candidate.familyId,
    candidate.kefgId,
    candidate.personId,
    candidate.relatedKefgId,
    candidate.cardId,
    candidate.qrToken
  ];

  const phoneValues = [
    candidate.phone,
    candidate.whatsapp
  ];

  const textMatch = textValues.some(function (value) {
    return (
      KGMIS_Admin_NormaliseText_(value)
        .indexOf(query) !== -1
    );
  });

  const idMatch = idValues.some(function (value) {
    const normalised =
      KGMIS_Admin_NormaliseId_(value);

    return Boolean(
      queryId &&
      normalised &&
      normalised.indexOf(queryId) !== -1
    );
  });

  const phoneMatch =
    queryPhone.length >= 4 &&
    phoneValues.some(function (value) {
      const normalised =
        KGMIS_Admin_NormalisePhone_(value);

      return Boolean(
        normalised &&
        normalised.indexOf(queryPhone) !== -1
      );
    });

  return textMatch || idMatch || phoneMatch;
}

function KGMIS_Admin_CardRowMatchesSearch_(card, searchText) {
  return KGMIS_Admin_CandidateMatchesSearch_(
    {
      name:
        KGMIS_Admin_GetRecordValue_(card, ['CARDHOLDER_NAME']),
      email:
        KGMIS_Admin_GetRecordValue_(card, ['MEMBER_EMAIL']),
      phone:
        KGMIS_Admin_GetRecordValue_(card, ['MEMBER_MOBILE']),
      whatsapp: '',
      familyId:
        KGMIS_Admin_GetRecordValue_(card, ['FAMILY_ID']),
      kefgId:
        KGMIS_Admin_GetRecordValue_(card, ['KEFG_ID']),
      personId: '',
      relatedKefgId: '',
      cardId:
        KGMIS_Admin_GetRecordValue_(card, ['CARD_ID']),
      qrToken:
        KGMIS_Admin_GetRecordValue_(card, ['QR_TOKEN']),
      cardholderType:
        KGMIS_Admin_GetRecordValue_(card, ['CARDHOLDER_TYPE']),
      memberCategory: '',
      familyRelation: '',
      membershipType:
        KGMIS_Admin_GetRecordValue_(card, ['MEMBERSHIP_TYPE']),
      membershipStatus:
        KGMIS_Admin_GetRecordValue_(card, ['MEMBERSHIP_STATUS']),
      paymentStatus: '',
      cardStatus:
        KGMIS_Admin_GetRecordValue_(card, ['CARD_STATUS'])
    },
    searchText
  );
}

function KGMIS_Admin_CreateSearchResponse_(candidate) {
  return {
    candidateKey: candidate.candidateKey || '',
    personKey: candidate.personKey || '',
    source: candidate.source || '',
    sourceRowNumber: candidate.sourceRowNumber || '',
    familyId: candidate.familyId || '',
    kefgId: candidate.kefgId || '',
    personId: candidate.personId || '',
    relatedKefgId: candidate.relatedKefgId || '',
    relationSequence: candidate.relationSequence || '',
    name: candidate.name || '',
    cardholderType: candidate.cardholderType || '',
    memberCategory: candidate.memberCategory || '',
    familyRelation: candidate.familyRelation || '',
    phone: candidate.phone || '',
    whatsapp: candidate.whatsapp || '',
    email: candidate.email || '',
    membershipType: candidate.membershipType || '',
    membershipYear: candidate.membershipYear || '',
    membershipStatus: candidate.membershipStatus || '',
    paymentStatus: candidate.paymentStatus || '',
    membershipYearRecordFound:
      Boolean(candidate.membershipYearRecordFound),
    membershipYearKey: candidate.membershipYearKey || '',
    amountDue: Number(candidate.amountDue || 0),
    amountReceived: Number(candidate.amountReceived || 0),
    outstandingDues: Number(candidate.outstandingDues || 0),
    alumniAssociation: candidate.alumniAssociation || '',
    photoFileId: candidate.photoFileId || '',
    photoUrl: candidate.photoUrl || '',
    recordStatus: candidate.recordStatus || '',
    cardEligible: Boolean(candidate.cardEligible),
    cardIssued: Boolean(candidate.cardIssued),
    cardId: candidate.cardId || '',
    cardStatus: candidate.cardStatus || '',
    issueDate: candidate.issueDate || '',
    validUntil: candidate.validUntil || '',
    cardVersion: candidate.cardVersion || '',
    cardImageUrl: candidate.cardImageUrl || '',
    cardPdfUrl: candidate.cardPdfUrl || '',
    qrToken: candidate.qrToken || ''
  };
}

function KGMIS_Admin_MergeDuplicateCandidates_(candidates) {
  candidates = Array.isArray(candidates) ? candidates : [];

  const index = {};
  const merged = [];

  candidates.forEach(function (candidate) {
    const key =
      candidate.candidateKey ||
      KGMIS_Admin_CreateCandidateKey_(
        candidate.kefgId,
        candidate.familyId,
        candidate.name,
        candidate.personId
      );

    if (!index[key]) {
      index[key] =
        KGMIS_Admin_CopyObject_(candidate);

      merged.push(index[key]);
      return;
    }

    KGMIS_Admin_MergeCandidateFields_(
      index[key],
      candidate
    );
  });

  return merged;
}

function KGMIS_Admin_MergeCandidateFields_(target, source) {
  Object.keys(source).forEach(function (key) {
    if (
      (
        target[key] === '' ||
        target[key] === null ||
        target[key] === undefined
      ) &&
      source[key] !== '' &&
      source[key] !== null &&
      source[key] !== undefined
    ) {
      target[key] = source[key];
    }
  });

  target.cardEligible =
    Boolean(target.cardEligible || source.cardEligible);

  target.cardIssued =
    Boolean(target.cardIssued || source.cardIssued);
}

function KGMIS_Admin_ReadSheetObjects_(
  spreadsheet,
  sheetName,
  required
) {
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    if (required) {
      throw new Error(sheetName + ' was not found.');
    }
    return [];
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2 || lastColumn < 1) {
    return [];
  }

  const range =
    sheet.getRange(1, 1, lastRow, lastColumn);

  const rawValues = range.getValues();
  const displayValues = range.getDisplayValues();

  const headers = displayValues[0].map(function (header) {
    return KGMIS_Admin_NormaliseHeader_(header);
  });

  return rawValues.slice(1).map(function (row, rowIndex) {
    const object = {
      __ROW_NUMBER__: rowIndex + 2,
      __DISPLAY__: {}
    };

    headers.forEach(function (header, columnIndex) {
      if (!header) {
        return;
      }

      object[header] = row[columnIndex];
      object.__DISPLAY__[header] =
        displayValues[rowIndex + 1][columnIndex];
    });

    return object;
  });
}


// 36.09_KGMIS_Module_Admin.gs — PART 3 OF 3
// Paste the three parts consecutively into the same Apps Script file.

function KGMIS_Admin_MapCardholderType_(memberCategory) {
  const category =
    KGMIS_Admin_NormaliseText_(memberCategory);

  if (
    category === 'PRIMARY MEMBER' ||
    category === 'ALUMNI SPOUSE MEMBER'
  ) {
    return 'PRIMARY MEMBER';
  }

  if (
    category === 'NON ALUMNI SPOUSE' ||
    category === 'SPOUSE'
  ) {
    return 'MEMBER';
  }

  if (
    category === 'DEPENDANT' ||
    category === 'DEPENDENT'
  ) {
    return 'DEPENDENT';
  }

  return 'MEMBER';
}

function KGMIS_Admin_GetMasterRelationSequence_(memberCategory) {
  return (
    KGMIS_Admin_NormaliseText_(memberCategory)
      .indexOf('SPOUSE') !== -1
      ? '02'
      : '01'
  );
}

function KGMIS_Admin_ShouldCreateEmbeddedSpouse_(
  row,
  memberCategory
) {
  const spouseName =
    KGMIS_Admin_GetValue_(row, ['SPOUSE_NAME']);

  if (!spouseName) {
    return false;
  }

  return (
    KGMIS_Admin_NormaliseText_(memberCategory)
      .indexOf('SPOUSE') === -1
  );
}

function KGMIS_Admin_IsAlumniSpouse_(
  spouseKefgId,
  spouseAssociation
) {
  if (KGMIS_Admin_CleanText_(spouseKefgId)) {
    return true;
  }

  return (
    KGMIS_ADMIN_CARD_SEARCH_CONFIG
      .ALUMNI_ASSOCIATIONS
      .indexOf(
        KGMIS_Admin_NormaliseId_(spouseAssociation)
      ) !== -1
  );
}

function KGMIS_Admin_SortSearchResults_(first, second) {
  const familyComparison =
    KGMIS_Admin_NormaliseId_(first.familyId)
      .localeCompare(
        KGMIS_Admin_NormaliseId_(second.familyId)
      );

  if (familyComparison !== 0) {
    return familyComparison;
  }

  const firstSequence = Number(
    KGMIS_Admin_NormaliseSequence_(
      first.relationSequence
    ) || 999
  );

  const secondSequence = Number(
    KGMIS_Admin_NormaliseSequence_(
      second.relationSequence
    ) || 999
  );

  if (firstSequence !== secondSequence) {
    return firstSequence - secondSequence;
  }

  return KGMIS_Admin_NormaliseText_(first.name)
    .localeCompare(
      KGMIS_Admin_NormaliseText_(second.name)
    );
}

function KGMIS_Admin_SortCardRecords_(first, second) {
  const priority = {
    ACTIVE: 1,
    EXTENDED: 2,
    INACTIVE: 3,
    EXPIRED: 4,
    REVOKED: 5,
    ARCHIVED: 6
  };

  const firstStatus = KGMIS_Admin_NormaliseId_(
    KGMIS_Admin_GetRecordValue_(first, ['CARD_STATUS'])
  );

  const secondStatus = KGMIS_Admin_NormaliseId_(
    KGMIS_Admin_GetRecordValue_(second, ['CARD_STATUS'])
  );

  const statusDifference =
    (priority[firstStatus] || 99) -
    (priority[secondStatus] || 99);

  if (statusDifference !== 0) {
    return statusDifference;
  }

  const firstUpdated =
    KGMIS_Admin_GetRecordDateValue_(
      first,
      ['UPDATED_ON', 'ISSUE_DATE']
    );

  const secondUpdated =
    KGMIS_Admin_GetRecordDateValue_(
      second,
      ['UPDATED_ON', 'ISSUE_DATE']
    );

  return secondUpdated - firstUpdated;
}

function KGMIS_Admin_GetValue_(row, headers) {
  row = row || {};
  headers = Array.isArray(headers) ? headers : [];

  for (
    let index = 0;
    index < headers.length;
    index += 1
  ) {
    const header =
      KGMIS_Admin_NormaliseHeader_(headers[index]);

    if (
      row.__DISPLAY__ &&
      Object.prototype.hasOwnProperty.call(
        row.__DISPLAY__,
        header
      )
    ) {
      const display =
        KGMIS_Admin_CleanText_(row.__DISPLAY__[header]);

      if (display) {
        return display;
      }
    }

    if (
      Object.prototype.hasOwnProperty.call(row, header)
    ) {
      const value =
        KGMIS_Admin_CleanText_(row[header]);

      if (value) {
        return value;
      }
    }
  }

  return '';
}

function KGMIS_Admin_GetRecordValue_(record, headers) {
  record = record || {};
  headers = Array.isArray(headers) ? headers : [];

  for (
    let index = 0;
    index < headers.length;
    index += 1
  ) {
    const header = headers[index];

    if (
      Object.prototype.hasOwnProperty.call(record, header)
    ) {
      const value =
        KGMIS_Admin_CleanText_(record[header]);

      if (value) {
        return value;
      }
    }
  }

  return '';
}

function KGMIS_Admin_GetRecordRawValue_(record, headers) {
  record = record || {};
  headers = Array.isArray(headers) ? headers : [];

  for (
    let index = 0;
    index < headers.length;
    index += 1
  ) {
    const header = headers[index];

    if (
      Object.prototype.hasOwnProperty.call(record, header)
    ) {
      return record[header];
    }
  }

  return '';
}

function KGMIS_Admin_GetRecordDateValue_(record, headers) {
  const value =
    KGMIS_Admin_GetRecordRawValue_(record, headers);

  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value.getTime();
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function KGMIS_Admin_CreateCandidateKey_(
  kefgId,
  familyId,
  name,
  personId
) {
  const safeKefgId =
    KGMIS_Admin_NormaliseId_(kefgId);

  if (safeKefgId) {
    return 'KEFG:' + safeKefgId;
  }

  const safePersonId =
    KGMIS_Admin_NormaliseId_(personId);

  if (safePersonId) {
    return 'PERSON:' + safePersonId;
  }

  return (
    'FAMILY_NAME:' +
    KGMIS_Admin_NormaliseId_(familyId) +
    ':' +
    KGMIS_Admin_NormaliseText_(name)
  );
}

function KGMIS_Admin_IsRecordActive_(value) {
  const status =
    KGMIS_Admin_NormaliseId_(value);

  return !status || status === 'ACTIVE';
}

function KGMIS_Admin_IsYes_(value) {
  return [
    'YES',
    'Y',
    'TRUE',
    '1',
    'ELIGIBLE'
  ].indexOf(
    KGMIS_Admin_NormaliseId_(value)
  ) !== -1;
}

function KGMIS_Admin_NormaliseSequence_(value) {
  const digits =
    KGMIS_Admin_CleanText_(value)
      .replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  const number = Number(digits);

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > 99
  ) {
    return '';
  }

  return String(number).padStart(2, '0');
}

function KGMIS_Admin_DisplayCategory_(value) {
  return KGMIS_Admin_CleanText_(value)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, function (letter) {
      return letter.toUpperCase();
    });
}

function KGMIS_Admin_NormaliseHeader_(value) {
  return KGMIS_Admin_CleanText_(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function KGMIS_Admin_NormaliseText_(value) {
  return KGMIS_Admin_CleanText_(value)
    .toUpperCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function KGMIS_Admin_NormaliseId_(value) {
  return KGMIS_Admin_CleanText_(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function KGMIS_Admin_NormalisePhone_(value) {
  return KGMIS_Admin_CleanText_(value)
    .replace(/\D/g, '');
}

function KGMIS_Admin_CleanText_(value) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/\s+/g, ' ');
}

function KGMIS_Admin_FormatOutputDate_(value) {
  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() || 'Asia/Kolkata',
      'yyyy-MM-dd'
    );
  }

  return KGMIS_Admin_CleanText_(value);
}

function KGMIS_Admin_CopyObject_(object) {
  const copy = {};

  Object.keys(object).forEach(function (key) {
    copy[key] = object[key];
  });

  return copy;
}

function KGMIS_TestAdminDigitalCardSearch_(
  sessionToken,
  searchText
) {
  const result =
    KGMIS_Admin_SearchDigitalCardCandidates(
      sessionToken,
      searchText
    );

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * ============================================================
 * ADMINISTRATION DASHBOARD STATISTICS
 * ============================================================
 * Read-only. Existing Administration functions are unchanged.
 */
function KGMIS_Admin_GetDashboardStatistics(sessionToken) {
  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'APPLICATION',
    'ADMINISTER'
  );

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
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
  const cardRows = KGMIS_ReadAllCards_() || [];
  const currentYear = KGMIS_GetCurrentFinancialYear().financialYear;

  const activeMasterRows = masterRows.filter(function (row) {
    return KGMIS_Admin_IsRecordActive_(
      KGMIS_Admin_GetValue_(row, ['RECORD_STATUS'])
    );
  });

  const activeFamilyMemberRows = familyMemberRows.filter(function (row) {
    return KGMIS_Admin_IsRecordActive_(
      KGMIS_Admin_GetValue_(row, ['RECORD_STATUS'])
    );
  });

  const familyIds = {};
  let alumniMembers = 0;
  let nonAlumniSpouses = 0;

  activeMasterRows.forEach(function (row) {
    const familyId = KGMIS_Admin_NormaliseId_(
      KGMIS_Admin_GetValue_(row, ['FAMILY_ID'])
    );
    if (familyId) familyIds[familyId] = true;

    const category = KGMIS_Admin_NormaliseText_(
      KGMIS_Admin_GetValue_(row, ['MEMBER_CATEGORY'])
    );
    const alumni = KGMIS_Admin_NormaliseId_(
      KGMIS_Admin_GetValue_(row, ['ALUMNI_ASSOCIATION'])
    );

    if (alumni && alumni !== 'NOTAPPLICABLE' && alumni !== 'NA') {
      alumniMembers++;
    }
    if (category === 'NON ALUMNI SPOUSE') {
      nonAlumniSpouses++;
    }
  });

  const membershipContext = KGMIS_GetMembershipYearContext_();
  const currentMembershipByFamily = {};

  for (let i = 1; i < membershipContext.values.length; i++) {
    const row = membershipContext.values[i];
    const fy = KGMIS_MembershipYearCleanValue_(
      row[membershipContext.column.FINANCIAL_YEAR]
    );
    const recordStatus = KGMIS_MembershipYearCleanValue_(
      row[membershipContext.column.RECORD_STATUS]
    ).toUpperCase();

    if (fy !== currentYear || recordStatus !== 'ACTIVE') continue;

    const membership = KGMIS_CreateMembershipYearObject_(
      row,
      membershipContext.column,
      i + 1
    );
    const familyId = KGMIS_Admin_NormaliseId_(membership.familyId);
    if (familyId) currentMembershipByFamily[familyId] = membership;
  }

  let activeFamilies = 0;
  let membershipPending = 0;
  let paidMembers = 0;

  Object.keys(currentMembershipByFamily).forEach(function (familyId) {
    const membership = currentMembershipByFamily[familyId];
    const membershipStatus =
      KGMIS_Admin_NormaliseText_(membership.membershipStatus);
    const paymentStatus =
      KGMIS_Admin_NormaliseText_(membership.paymentStatus);

    if (
      membershipStatus === 'CURRENT' ||
      membershipStatus === 'LIFETIME MEMBER' ||
      membershipStatus === 'EXEMPT'
    ) activeFamilies++;

    if (membershipStatus === 'PENDING' || paymentStatus !== 'PAID') {
      membershipPending++;
    }
    if (paymentStatus === 'PAID') paidMembers++;
  });

  let activeCards = 0;
  let extendedCards = 0;
  let revokedCards = 0;

  cardRows.forEach(function (card) {
    const status = KGMIS_Admin_NormaliseId_(
      KGMIS_Admin_GetRecordValue_(card, ['CARD_STATUS'])
    );
    if (status === 'ACTIVE') activeCards++;
    else if (status === 'EXTENDED') extendedCards++;
    else if (status === 'REVOKED') revokedCards++;
  });

  return {
    success: true,
    financialYear: currentYear,
    statistics: {
      digitalCardRecords: cardRows.length,
      activeCards: activeCards,
      extendedCards: extendedCards,
      revokedCards: revokedCards,
      totalMembers: activeMasterRows.length + activeFamilyMemberRows.length,
      totalFamilies: Object.keys(familyIds).length,
      activeFamilies: activeFamilies,
      newMembers: 0,
      membershipPending: membershipPending,
      paidMembers: paidMembers,
      alumniMembers: alumniMembers,
      nonAlumniSpouses: nonAlumniSpouses
    }
  };
}

/**
 * ============================================================
 * ACCESS CONTROL — ADMINISTRATION MODULE
 * ============================================================
 */
function KGMIS_Admin_GetAccessControlUsers(sessionToken) {
  KGMIS_OTP_RequireSessionAccess_(sessionToken, 'APPLICATION', 'ADMINISTER');
  const context=KGMIS_GetAccessControlContext_();
  const c=context.column;
  const tz=Session.getScriptTimeZone()||'Asia/Kolkata';
  const fmt=function(value) {
    if (!value) return '';
    if (Object.prototype.toString.call(value)==='[object Date]' && !isNaN(value.getTime())) {
      return Utilities.formatDate(value,tz,'dd-MMM-yyyy HH:mm');
    }
    return String(value||'').trim();
  };
  const users=context.values.slice(1).map(function(row) {
    return {
      email:String(row[c.EMAIL]||'').trim().toLowerCase(),
      userName:String(row[c.USER_NAME]||'').trim(),
      role:String(row[c.ROLE]||'').trim().toUpperCase(),
      status:String(row[c.STATUS]||'').trim().toUpperCase(),
      lastLogin:fmt(row[c.LAST_LOGIN]),
      createdOn:fmt(row[c.CREATED_ON]),
      createdBy:String(row[c.CREATED_BY]||'').trim(),
      updatedOn:fmt(row[c.UPDATED_ON]),
      updatedBy:String(row[c.UPDATED_BY]||'').trim(),
      remarks:String(row[c.REMARKS]||'').trim()
    };
  }).filter(function(user){return user.email;});
  users.sort(function(a,b){return a.email.localeCompare(b.email);});
  return {success:true,users:users};
}

function KGMIS_Admin_SaveAccessControlUser(sessionToken,payload) {
  const adminUser=KGMIS_OTP_RequireSessionAccess_(sessionToken,'APPLICATION','ADMINISTER');
  payload=payload&&typeof payload==='object'?payload:{};
  const email=String(payload.email||'').trim().toLowerCase();
  const userName=String(payload.userName||'').trim();
  const role=String(payload.role||'').trim().toUpperCase();
  const status=String(payload.status||'').trim().toUpperCase();
  const remarks=String(payload.remarks||'').trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (!userName) throw new Error('User Name is required.');
  if (['DIRECTORY_USER','VIEWER','TREASURER','ADMIN','SUPER_ADMIN'].indexOf(role)===-1) throw new Error('Invalid KGMIS role.');
  if (['ACTIVE','INACTIVE'].indexOf(status)===-1) throw new Error('Invalid account status.');

  const context=KGMIS_GetAccessControlContext_();
  const c=context.column;
  const now=new Date();
  const actor=String(adminUser.email||adminUser.userName||'').trim();
  let existingRow=0;

  for (let i=1;i<context.values.length;i++) {
    if (String(context.values[i][c.EMAIL]||'').trim().toLowerCase()===email) {
      existingRow=i+1;
      break;
    }
  }

  if (existingRow) {
    context.sheet.getRange(existingRow,c.USER_NAME+1).setValue(userName);
    context.sheet.getRange(existingRow,c.ROLE+1).setValue(role);
    context.sheet.getRange(existingRow,c.STATUS+1).setValue(status);
    context.sheet.getRange(existingRow,c.UPDATED_ON+1).setValue(now);
    context.sheet.getRange(existingRow,c.UPDATED_BY+1).setValue(actor);
    context.sheet.getRange(existingRow,c.REMARKS+1).setValue(remarks);
  } else {
    const row=new Array(context.headers.length).fill('');
    row[c.EMAIL]=email;
    row[c.USER_NAME]=userName;
    row[c.ROLE]=role;
    row[c.STATUS]=status;
    row[c.CREATED_ON]=now;
    row[c.CREATED_BY]=actor;
    row[c.REMARKS]=remarks;
    context.sheet.appendRow(row);
  }

  SpreadsheetApp.flush();

  if (typeof KGMIS_Login_SyncEffectiveRoles==='function') {
    KGMIS_Login_SyncEffectiveRoles();
  }

  return {
    success:true,
    created:!existingRow,
    updated:Boolean(existingRow),
    email:email,
    message:existingRow?'Access Control user updated successfully.':'Access Control user added successfully.'
  };
}

