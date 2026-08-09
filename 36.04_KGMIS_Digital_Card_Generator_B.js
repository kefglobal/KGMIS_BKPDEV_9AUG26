/**
 * ============================================================
 * 34.02B KGMIS DIGITAL CARD GENERATOR
 * ============================================================
 *
 * SECTION 11 ONWARDS
 *
 * Card ID generation
 * QR payload generation
 * Card rendering
 * Output generation
 * Database writing
 *
 * ============================================================
 */

/**
 * ============================================================
 * SECTION 11
 * GENERATE CARD ID
 * ============================================================
 *
 * Generates a deterministic Digital Card ID.
 *
 * Example
 *
 * FAMILY_ID          : FAM00035
 * RELATION_SEQUENCE  : 01
 *
 * CARD_ID            : KEFG0003501
 *
 * ============================================================
 */

function KGMIS_GenerateCardId_(
  familyId,
  relationSequence
) {

  const familyNumber =
    String(familyId || "")
      .trim()
      .toUpperCase()
      .replace(/^FAM/, "");

  const sequence =
    String(relationSequence || "")
      .trim();

  return (

  KGMIS_DIGITAL_CARD_ENGINE_CONFIG
    .PREFIX
    .CARD +

  familyNumber +

  sequence

);

}

/**
 * ============================================================
 * SECTION 11
 * ASSIGN CARD IDS
 * ============================================================
 *
 * Receives:
 *
 * cardGenerationBundle
 *
 * Returns:
 *
 * The same cardGenerationBundle with person.cardId populated
 * for every cardholder.
 *
 * ============================================================
 */

function KGMIS_AssignCardIds_(
  cardGenerationBundle
) {

  if (!cardGenerationBundle) {

    throw new Error(
      "Card Generation Bundle is required."
    );

  }

  if (
    !Array.isArray(
      cardGenerationBundle.persons
    )
  ) {

    throw new Error(
      "Card Generation Bundle contains no Person Objects."
    );

  }

  const usedCardIds = {};

  cardGenerationBundle.persons.forEach(
    function(person) {

      const cardId =
        KGMIS_GenerateCardId_(
          person.familyId,
          person.relationSequence
        );

      if (usedCardIds[cardId]) {

        throw new Error(
          "Duplicate CARD_ID generated: " +
          cardId
        );

      }

      person.cardId =
        cardId;

      usedCardIds[cardId] =
        true;

    }
  );

  return cardGenerationBundle;

}

/**
 * ============================================================
 * SAFE TEST
 * SECTION 11
 * CARD ID GENERATOR
 * ============================================================
 */

function KGMIS_TestCardIdGenerator(
  familyId
) {

  const testFamilyId =
    String(
      familyId || "FAM00035"
    )
      .trim()
      .toUpperCase();

  Logger.log(
    "================================"
  );

  Logger.log(
    "CARD ID GENERATOR"
  );

  Logger.log(
    "================================"
  );

  //----------------------------------------------------------
  // Get Eligible Family
  //----------------------------------------------------------

  const eligibleFamily =
    KGMIS_GetEligibleFamilies_()
      .find(function(family) {

        return (
          String(
            family.familyId || ""
          )
            .trim()
            .toUpperCase()

          ===

          testFamilyId
        );

      });

  if (!eligibleFamily) {

    throw new Error(
      testFamilyId +
      " is not an eligible PAID family."
    );

  }

  //----------------------------------------------------------
  // Build Section 10 Bundle
  //----------------------------------------------------------

  const cardGenerationBundle =
    KGMIS_BuildCardGenerationBundle_(
      eligibleFamily
    );

  if (!cardGenerationBundle.success) {

    throw new Error(
      cardGenerationBundle.message ||
      "Card Generation Bundle failed."
    );

  }

  //----------------------------------------------------------
  // Assign Card IDs
  //----------------------------------------------------------

  KGMIS_AssignCardIds_(
    cardGenerationBundle
  );

  //----------------------------------------------------------
  // Display Result
  //----------------------------------------------------------

  cardGenerationBundle.persons
    .forEach(function(person) {

      Logger.log(
        String(person.fullName || "") +
        " | Sequence: " +
        String(person.relationSequence || "") +
        " | Card ID: " +
        String(person.cardId || "")
      );

    });

  //----------------------------------------------------------
  // Final Validation
  //----------------------------------------------------------

  const allCardIdsCreated =
    cardGenerationBundle.persons
      .every(function(person) {

        return Boolean(person.cardId);

      });

  Logger.log(
    "Validation : " +
    (
      allCardIdsCreated
        ? "PASS"
        : "FAIL"
    )
  );

  return cardGenerationBundle;

}

/**
 * ============================================================
 * SECTION 12
 * GENERATE QR PAYLOAD
 * ============================================================
 *
 * Generates the QR payload for one Digital Membership Card.
 *
 * Example
 *
 * CARD_ID
 *
 * KEFG0003501
 *
 * QR PAYLOAD
 *
 * https://kefglobal.org/card/KEFG0003501
 *
 * ============================================================
 */

function KGMIS_GenerateQrPayload_(
  cardId
) {

  if (!cardId) {

    throw new Error(
      "CARD_ID is required."
    );

  }

  return (

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .QR
      .BASE_URL +

    String(cardId)
      .trim()

  );

}

/**
 * ============================================================
 * SECTION 12 - QR TOKEN GENERATOR
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

/**
 * Generates a new QR verification token.
 *
 * @return {string}
 */
function KGMIS_GenerateQrToken_() {

  const token =
    Utilities
      .getUuid()
      .replace(/-/g, '')
      .toUpperCase();

  if (!token) {
    throw new Error(
      'QR token generation failed.'
    );
  }

  return token;
}


/**
 * Assigns QR tokens to cardholder records.
 *
 * Existing tokens are retained.
 *
 * @param {Object[]} cardholders
 * @return {Object[]}
 */
function KGMIS_AssignQrTokens_(
  cardholders
) {

  if (!Array.isArray(cardholders)) {
    throw new Error(
      'Cardholder records must be provided as an array.'
    );
  }

  return cardholders.map(
    function (cardholder) {

      if (
        !cardholder ||
        typeof cardholder !== 'object'
      ) {
        throw new Error(
          'Invalid cardholder record.'
        );
      }

      const record =
        Object.assign(
          {},
          cardholder
        );

      const existingToken =
        KGMIS_CleanQrToken_(
          record.qrToken ||
          record.QR_TOKEN
        );

      record.qrToken =
        existingToken ||
        KGMIS_GenerateQrToken_();

      return record;
    }
  );
}


/**
 * Cleans a QR token.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_CleanQrToken_(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}


/**
 * ============================================================
 * TEST - QR TOKEN GENERATOR
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */
function KGMIS_TestQrTokenGenerator() {

  const firstToken =
    KGMIS_GenerateQrToken_();

  const secondToken =
    KGMIS_GenerateQrToken_();

  const result = {

    success:
      Boolean(
        firstToken &&
        secondToken &&
        firstToken !== secondToken &&
        /^[A-F0-9]{32}$/.test(firstToken) &&
        /^[A-F0-9]{32}$/.test(secondToken)
      ),

    firstToken:
      firstToken,

    secondToken:
      secondToken,

    firstTokenLength:
      firstToken.length,

    secondTokenLength:
      secondToken.length

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
 * ============================================================
 * TEST - ASSIGN QR TOKENS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */
function KGMIS_TestAssignQrTokens() {

  const existingToken =
    'ABCDEF1234567890ABCDEF1234567890';

  const cardholders = [
    {
      cardId:
        'KEFG0000101',

      qrToken:
        ''
    },
    {
      cardId:
        'KEFG0000102',

      qrToken:
        existingToken
    }
  ];

  const assigned =
    KGMIS_AssignQrTokens_(
      cardholders
    );

  const result = {

    success:
      Boolean(
        assigned.length === 2 &&
        assigned[0].qrToken &&
        assigned[0].qrToken.length === 32 &&
        assigned[1].qrToken === existingToken
      ),

    records:
      assigned

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
 * ============================================================
 * SECTION 13.1 - BUILD CARD RECORD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_BuildCardRecord_(
  person
) {

  // Validate Person

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  const clean =
    function (value) {

      if (
        value === null ||
        value === undefined
      ) {
        return '';
      }

      return String(value)
        .trim()
        .replace(/\s+/g, ' ');
    };

  const cardId =
    clean(
      person.cardId ||
      person.CARD_ID
    ).toUpperCase();

  const familyId =
    clean(
      person.familyId ||
      person.FAMILY_ID
    ).toUpperCase();

  const kefgId =
    clean(
      person.kefgId ||
      person.KEFG_ID
    ).toUpperCase();

  const cardholderName =
    clean(
      person.cardholderName ||
      person.memberName ||
      person.CARDHOLDER_NAME ||
      person.MEMBER_NAME
    );

  const cardholderType =
    clean(
      person.cardholderType ||
      person.CARDHOLDER_TYPE
    ).toUpperCase();

  const relationSequence =
    clean(
      person.relationSequence ||
      person.RELATION_SEQUENCE
    ).padStart(2, '0');

  const qrToken =
    KGMIS_CleanQrToken_(
      person.qrToken ||
      person.QR_TOKEN
    );

  // Required Fields

  if (!cardId) {
    throw new Error(
      'CARD_ID is required.'
    );
  }

  if (!familyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  if (!kefgId) {
    throw new Error(
      'KEFG_ID is required.'
    );
  }

  if (!cardholderName) {
    throw new Error(
      'CARDHOLDER_NAME is required.'
    );
  }

  if (!cardholderType) {
    throw new Error(
      'CARDHOLDER_TYPE is required.'
    );
  }

  if (!relationSequence) {
    throw new Error(
      'RELATION_SEQUENCE is required.'
    );
  }

  if (!qrToken) {
    throw new Error(
      'QR_TOKEN is required.'
    );
  }

  // Build Record

  return {

    CARD_ID:
      cardId,

    FAMILY_ID:
      familyId,

    KEFG_ID:
      kefgId,

    CARDHOLDER_TYPE:
      cardholderType,

    RELATION_SEQUENCE:
      relationSequence,

    CARDHOLDER_NAME:
      cardholderName,

    MEMBERSHIP_TYPE:
      clean(
        person.membershipType ||
        person.MEMBERSHIP_TYPE
      ).toUpperCase(),

    MEMBERSHIP_YEAR:
      clean(
        person.membershipYear ||
        person.financialYear ||
        person.MEMBERSHIP_YEAR
      ),

    MEMBERSHIP_STATUS:
      clean(
        person.membershipStatus ||
        person.MEMBERSHIP_STATUS
      ).toUpperCase(),

    ISSUE_DATE:
        KGMIS_GetCardIssueDate_(),

    VALID_UNTIL:
        KGMIS_GetCardValidUntil_(
        person
      ),

    CARD_STATUS:
        KGMIS_GetCardStatus_(
        person
      ),

    MEMBER_MOBILE:
        KGMIS_GetMemberMobile_(
        person
      ),

    MEMBER_EMAIL:
        KGMIS_GetMemberEmail_(
        person
      ),

    PHOTO_FILE_ID:
        KGMIS_GetPhotoFileId_(
        person
      ),

    PHOTO_URL:
        KGMIS_GetPhotoUrl_(
        person
      ),

    QR_TOKEN:
      qrToken,

    CARD_PDF_FILE_ID:
      clean(
        person.cardPdfFileId ||
        person.CARD_PDF_FILE_ID
      ),

    CARD_PDF_FILE_URL:
      clean(
        person.cardPdfFileUrl ||
        person.CARD_PDF_FILE_URL
      ),

    CARD_IMAGE_FILE_ID:
      clean(
        person.cardImageFileId ||
        person.CARD_IMAGE_FILE_ID
      ),

    CARD_IMAGE_FILE_URL:
      clean(
        person.cardImageFileUrl ||
        person.CARD_IMAGE_FILE_URL
      ),

    CREATED_ON:
        KGMIS_GetCreatedOn_(
        person
      ),

    CREATED_BY:
        KGMIS_GetCreatedBy_(
        person
      ),

    UPDATED_ON:
        KGMIS_GetUpdatedOn_(),

    UPDATED_BY:
        KGMIS_GetUpdatedBy_(
        person
      ),

    CARD_VERSION:
      clean(
        person.cardVersion ||
        person.CARD_VERSION ||
        '1.0'
      ),

    REMARKS:
      clean(
        person.remarks ||
        person.REMARKS
      )

  };
}

/**
 * ============================================================
 * SECTION 13.2 - CARD DATES
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

/**
 * Returns the Card Issue Date.
 *
 * @return {Date}
 */
function KGMIS_GetCardIssueDate_() {

  return new Date();

}


/**
 * Returns the Card Valid Until Date.
 *
 * @param {Object} person
 * @return {*}
 */
function KGMIS_GetCardValidUntil_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  if (
    person.validUntil
  ) {
    return person.validUntil;
  }

  if (
    person.VALID_UNTIL
  ) {
    return person.VALID_UNTIL;
  }

  throw new Error(
    'VALID_UNTIL is required.'
  );

}


/**
 * ============================================================
 * 13.2 TEST - CARD DATES
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */
function KGMIS_TestCardDates() {

  const person = {

    validUntil:
      new Date(
        2027,
        2,
        31
      )

  };

  const issueDate =
    KGMIS_GetCardIssueDate_();

  const validUntil =
    KGMIS_GetCardValidUntil_(
      person
    );

  const result = {

    success:
      (
        issueDate instanceof Date &&
        validUntil instanceof Date
      ),

    issueDate:
      issueDate,

    validUntil:
      validUntil

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
 * ============================================================
 * SECTION 13.3 - CARD STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

/**
 * Returns the Card Status.
 *
 * @param {Object} person
 * @return {string}
 */
function KGMIS_GetCardStatus_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  const status =
    KGMIS_CleanCardStatus_(
      person.cardStatus ||
      person.CARD_STATUS
    );

  return (
    status ||
    'ACTIVE'
  );

}


/**
 * Cleans a Card Status.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_CleanCardStatus_(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

}


/**
 * Validates a Card Status.
 *
 * @param {string} status
 * @return {boolean}
 */
function KGMIS_IsValidCardStatus_(
  status
) {

  return [

    'ACTIVE',

    'EXTENDED',

    'REVOKED'

  ].indexOf(

    KGMIS_CleanCardStatus_(
      status
    )

  ) !== -1;

}


/**
 * ============================================================
 * 13.3 TEST - CARD STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */
function KGMIS_TestCardStatus() {

  const tests = [

    {
      input:
        {},

      expected:
        'ACTIVE'
    },

    {
      input:
        {
          cardStatus:
            'ACTIVE'
        },

      expected:
        'ACTIVE'
    },

    {
      input:
        {
          CARD_STATUS:
            'extended'
        },

      expected:
        'EXTENDED'
    },

    {
      input:
        {
          cardStatus:
            'REVOKED'
        },

      expected:
        'REVOKED'
    }

  ];

  const results =
    tests.map(
      function (test) {

        const actual =
          KGMIS_GetCardStatus_(
            test.input
          );

        return {

          expected:
            test.expected,

          actual:
            actual,

          passed:
            actual ===
            test.expected

        };

      }
    );

  const result = {

    success:
      results.every(
        function (item) {
          return item.passed;
        }
      ),

    results:
      results

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
 * ============================================================
 * SECTION 13.4 - MEMBER CONTACT
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

/**
 * Returns the Member Mobile.
 *
 * @param {Object} person
 * @return {string}
 */
function KGMIS_GetMemberMobile_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  return String(
    person.memberMobile ||
    person.MEMBER_MOBILE ||
    ''
  ).trim();

}


/**
 * Returns the Member Email.
 *
 * @param {Object} person
 * @return {string}
 */
function KGMIS_GetMemberEmail_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  return String(
    person.memberEmail ||
    person.MEMBER_EMAIL ||
    ''
  )
    .trim()
    .toLowerCase();

}


/**
 * ============================================================
 * 13.4 TEST - MEMBER CONTACT
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */
function KGMIS_TestMemberContact() {

  const person = {

    memberMobile:
      '9876543210',

    memberEmail:
      'James@Example.COM'

  };

  const result = {

    success:
      true,

    mobile:
      KGMIS_GetMemberMobile_(
        person
      ),

    email:
      KGMIS_GetMemberEmail_(
        person
      )

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
 * ============================================================
 * SECTION 13.5 - PHOTO INFORMATION
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_GetPhotoFileId_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  return String(
    person.photoFileId ||
    person.PHOTO_FILE_ID ||
    person.photo ||
    person.PHOTO ||
    ''
  ).trim();

}


function KGMIS_GetPhotoUrl_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  return String(
    person.photoUrl ||
    person.PHOTO_URL ||
    ''
  ).trim();

}


/**
 * ============================================================
 * 13.5 TEST - PHOTO INFORMATION
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestPhotoInformation() {

  const person = {

    photoFileId:
      'TEST_PHOTO_FILE_ID',

    photoUrl:
      'https://example.com/photo.jpg'

  };

  const photoFileId =
    KGMIS_GetPhotoFileId_(
      person
    );

  const photoUrl =
    KGMIS_GetPhotoUrl_(
      person
    );

  const result = {

    success:
      (
        photoFileId ===
          'TEST_PHOTO_FILE_ID' &&
        photoUrl ===
          'https://example.com/photo.jpg'
      ),

    photoFileId:
      photoFileId,

    photoUrl:
      photoUrl

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
 * ============================================================
 * SECTION 13.6 - AUDIT FIELDS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_GetAuditUser_() {

  return (
    Session.getActiveUser().getEmail() ||
    'KGMIS_SYSTEM'
  );

}


function KGMIS_GetCreatedOn_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  return (
    person.createdOn ||
    person.CREATED_ON ||
    new Date()
  );

}


function KGMIS_GetCreatedBy_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  return String(
    person.createdBy ||
    person.CREATED_BY ||
    KGMIS_GetAuditUser_()
  ).trim();

}


function KGMIS_GetUpdatedOn_() {

  return new Date();

}


function KGMIS_GetUpdatedBy_(
  person
) {

  if (
    !person ||
    typeof person !== 'object'
  ) {
    throw new Error(
      'A valid person object is required.'
    );
  }

  return String(
    person.updatedBy ||
    person.UPDATED_BY ||
    KGMIS_GetAuditUser_()
  ).trim();

}


/**
 * ============================================================
 * 13.6 TEST - AUDIT FIELDS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestAuditFields() {

  const person = {};

  const createdOn =
    KGMIS_GetCreatedOn_(
      person
    );

  const createdBy =
    KGMIS_GetCreatedBy_(
      person
    );

  const updatedOn =
    KGMIS_GetUpdatedOn_();

  const updatedBy =
    KGMIS_GetUpdatedBy_(
      person
    );

  const result = {

    success:
      (
        createdOn instanceof Date &&
        updatedOn instanceof Date &&
        Boolean(createdBy) &&
        Boolean(updatedBy)
      ),

    createdOn:
      createdOn,

    createdBy:
      createdBy,

    updatedOn:
      updatedOn,

    updatedBy:
      updatedBy

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
 * ============================================================
 * SECTION 13.7 - TEST BUILD CARD RECORD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestBuildCardRecord() {

  const samplePerson = {

    cardId:
      'KEFG0000101',

    familyId:
      'FAM00001',

    kefgId:
      'KEFG1001',

    cardholderType:
      'PRIMARY_MEMBER',

    relationSequence:
      '01',

    cardholderName:
      'James Joseph Alenchery',

    membershipType:
      'ANNUAL',

    membershipYear:
      '2026-27',

    membershipStatus:
      'CURRENT',

    issueDate:
      new Date(2026, 6, 23),

    validUntil:
      new Date(2027, 2, 31),

    cardStatus:
      'ACTIVE',

    memberMobile:
      '9999999999',

    memberEmail:
      'james@example.com',

    photoFileId:
      'TEST_PHOTO_FILE_ID',

    photoUrl:
      '',

    qrToken:
      KGMIS_GenerateQrToken_(),

    cardVersion:
      '1.0',

    remarks:
      'Card Record Builder test'

  };

  const record =
    KGMIS_BuildCardRecord_(
      samplePerson
    );

  const requiredFields = [
    'CARD_ID',
    'FAMILY_ID',
    'KEFG_ID',
    'CARDHOLDER_TYPE',
    'RELATION_SEQUENCE',
    'CARDHOLDER_NAME',
    'MEMBERSHIP_YEAR',
    'MEMBERSHIP_STATUS',
    'ISSUE_DATE',
    'VALID_UNTIL',
    'CARD_STATUS',
    'QR_TOKEN',
    'CARD_VERSION'
  ];

  const missingFields =
    requiredFields.filter(
      function (field) {

        return (
          record[field] === null ||
          record[field] === undefined ||
          record[field] === ''
        );
      }
    );

  const expectedValues = {

    CARD_ID:
      'KEFG0000101',

    FAMILY_ID:
      'FAM00001',

    KEFG_ID:
      'KEFG1001',

    CARDHOLDER_TYPE:
      'PRIMARY_MEMBER',

    RELATION_SEQUENCE:
      '01',

    CARDHOLDER_NAME:
      'James Joseph Alenchery',

    MEMBERSHIP_YEAR:
      '2026-27',

    MEMBERSHIP_STATUS:
      'CURRENT',

    CARD_STATUS:
      'ACTIVE',

    MEMBER_EMAIL:
      'james@example.com',

    CARD_VERSION:
      '1.0'

  };

  const incorrectFields =
    Object.keys(expectedValues)
      .filter(
        function (field) {

          return (
            record[field] !==
            expectedValues[field]
          );
        }
      );

  const result = {

    success:
      (
        missingFields.length === 0 &&
        incorrectFields.length === 0 &&
        /^[A-F0-9]{32}$/.test(
          record.QR_TOKEN
        )
      ),

    missingFields:
      missingFields,

    incorrectFields:
      incorrectFields,

    qrTokenLength:
      record.QR_TOKEN.length,

    record:
      record

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
 * ============================================================
 * SECTION 14.1 - EXISTING CARD DETECTION
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_FindExistingCard_(
  cardRecord,
  existingCards
) {

  // Validate Card Record

  if (
    !cardRecord ||
    typeof cardRecord !== 'object'
  ) {
    throw new Error(
      'A valid card record is required.'
    );
  }

  // Validate Existing Cards

  if (!Array.isArray(existingCards)) {
    throw new Error(
      'Existing card records must be provided as an array.'
    );
  }

  const cardId =
    String(
      cardRecord.CARD_ID ||
      cardRecord.cardId ||
      ''
    )
      .trim()
      .toUpperCase();

  const membershipYear =
    String(
      cardRecord.MEMBERSHIP_YEAR ||
      cardRecord.membershipYear ||
      ''
    ).trim();

  if (!cardId) {
    throw new Error(
      'CARD_ID is required for existing card detection.'
    );
  }

  if (!membershipYear) {
    throw new Error(
      'MEMBERSHIP_YEAR is required for existing card detection.'
    );
  }

  for (
    let index = 0;
    index < existingCards.length;
    index += 1
  ) {

    const existingCard =
      existingCards[index];

    if (
      !existingCard ||
      typeof existingCard !== 'object'
    ) {
      continue;
    }

    const existingCardId =
      String(
        existingCard.CARD_ID ||
        existingCard.cardId ||
        ''
      )
        .trim()
        .toUpperCase();

    const existingMembershipYear =
      String(
        existingCard.MEMBERSHIP_YEAR ||
        existingCard.membershipYear ||
        ''
      ).trim();

    if (
      existingCardId === cardId &&
      existingMembershipYear === membershipYear
    ) {
      return existingCard;
    }
  }

  return null;
}

/**
 * ============================================================
 * 14.1 TEST - EXISTING CARD DETECTION
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestFindExistingCard() {

  const existingCards = [

    {
      CARD_ID:
        'KEFG0003501',

      FAMILY_ID:
        'FAM00035',

      KEFG_ID:
        'KEFG1001',

      CARDHOLDER_TYPE:
        'PRIMARY_MEMBER',

      RELATION_SEQUENCE:
        '01',

      MEMBERSHIP_YEAR:
        '2026-27',

      QR_TOKEN:
        'ABCDEF1234567890ABCDEF1234567890'
    },

    {
      CARD_ID:
        'KEFG0003502',

      FAMILY_ID:
        'FAM00035',

      KEFG_ID:
        '',

      CARDHOLDER_TYPE:
        'SPOUSE',

      RELATION_SEQUENCE:
        '02',

      MEMBERSHIP_YEAR:
        '2026-27',

      QR_TOKEN:
        '1234567890ABCDEF1234567890ABCDEF'
    },

    {
      CARD_ID:
        'KEFG0003503',

      FAMILY_ID:
        'FAM00035',

      KEFG_ID:
        '',

      CARDHOLDER_TYPE:
        'DEPENDANT',

      RELATION_SEQUENCE:
        '03',

      MEMBERSHIP_YEAR:
        '2026-27',

      QR_TOKEN:
        'FEDCBA0987654321FEDCBA0987654321'
    }

  ];

  // Existing member card

  const memberRecord = {

    CARD_ID:
      'KEFG0003501',

    MEMBERSHIP_YEAR:
      '2026-27'

  };

  // Existing dependant without KEFG_ID

  const dependantRecord = {

    CARD_ID:
      'KEFG0003503',

    KEFG_ID:
      '',

    MEMBERSHIP_YEAR:
      '2026-27'

  };

  // Same Card ID but different year

  const nextYearRecord = {

    CARD_ID:
      'KEFG0003501',

    MEMBERSHIP_YEAR:
      '2027-28'

  };

  // Completely new card

  const newCardRecord = {

    CARD_ID:
      'KEFG0003504',

    MEMBERSHIP_YEAR:
      '2026-27'

  };

  const memberMatch =
    KGMIS_FindExistingCard_(
      memberRecord,
      existingCards
    );

  const dependantMatch =
    KGMIS_FindExistingCard_(
      dependantRecord,
      existingCards
    );

  const nextYearMatch =
    KGMIS_FindExistingCard_(
      nextYearRecord,
      existingCards
    );

  const newCardMatch =
    KGMIS_FindExistingCard_(
      newCardRecord,
      existingCards
    );

  const result = {

    success:
      Boolean(
        memberMatch &&
        memberMatch.CARD_ID ===
          'KEFG0003501' &&

        dependantMatch &&
        dependantMatch.CARD_ID ===
          'KEFG0003503' &&

        nextYearMatch === null &&

        newCardMatch === null
      ),

    memberCardFound:
      Boolean(memberMatch),

    memberCardId:
      memberMatch
        ? memberMatch.CARD_ID
        : '',

    dependantCardFound:
      Boolean(dependantMatch),

    dependantCardId:
      dependantMatch
        ? dependantMatch.CARD_ID
        : '',

    nextYearTreatedAsNew:
      nextYearMatch === null,

    newCardDetected:
      newCardMatch === null

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
 * ============================================================
 * SECTION 14.2 - DETERMINE INSERT OR UPDATE
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_PrepareCardUpsert_(
  cardRecord,
  existingCard
) {

  // Validate Card Record

  if (
    !cardRecord ||
    typeof cardRecord !== 'object'
  ) {
    throw new Error(
      'A valid card record is required.'
    );
  }

  const result = {

    action:
      'INSERT',

    record:
      Object.assign(
        {},
        cardRecord
      )

  };

  if (!existingCard) {
    return result;
  }

  result.action =
    'UPDATE';

  // Preserve immutable fields

  result.record.CARD_ID =
    existingCard.CARD_ID;

  result.record.QR_TOKEN =
    existingCard.QR_TOKEN;

  result.record.CREATED_ON =
    existingCard.CREATED_ON;

  result.record.CREATED_BY =
    existingCard.CREATED_BY;

  // Update audit

  result.record.UPDATED_ON =
    KGMIS_GetUpdatedOn_();

  result.record.UPDATED_BY =
    KGMIS_GetUpdatedBy_(
      cardRecord
    );

  return result;

}

/**
 * ============================================================
 * 14.2 TEST - CARD UPSERT PREPARATION
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestPrepareCardUpsert() {

  const newCard = {

    CARD_ID:
      'KEFG0003501',

    QR_TOKEN:
      'NEWTOKEN',

    CREATED_ON:
      '',

    CREATED_BY:
      '',

    UPDATED_ON:
      '',

    UPDATED_BY:
      ''

  };

  const existingCard = {

    CARD_ID:
      'KEFG0003501',

    QR_TOKEN:
      'OLDTOKEN',

    CREATED_ON:
      new Date(2026,0,1),

    CREATED_BY:
      'SYSTEM'

  };

  const insertResult =
    KGMIS_PrepareCardUpsert_(
      newCard,
      null
    );

  const updateResult =
    KGMIS_PrepareCardUpsert_(
      newCard,
      existingCard
    );

  const result = {

    success:
      (
        insertResult.action === 'INSERT' &&
        updateResult.action === 'UPDATE' &&
        updateResult.record.QR_TOKEN === 'OLDTOKEN' &&
        updateResult.record.CREATED_BY === 'SYSTEM'
      ),

    insert:
      insertResult,

    update:
      updateResult

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



