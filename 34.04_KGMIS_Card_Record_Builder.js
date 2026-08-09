/**
 * ============================================================
 * PART 4C.4
 * COMPLETE CARD RECORD BUILDER
 * ============================================================
 *
 * Builds one complete Digital Membership Card Record.
 *
 * INPUT
 * -----
 * person
 * membershipRecord
 *
 * OUTPUT
 * ------
 * One Card Record Object matching the
 * KEFG_MEMBER_CARDS schema.
 *
 * No database updates are performed here.
 *
 * ============================================================
 */

function KGMIS_CreateCardRecord_(

  person,

  membershipRecord

){

  if(!person){

    throw new Error(
      "Person object required."
    );

  }

  if(!membershipRecord){

    throw new Error(
      "Membership record required."
    );

  }

  const now = new Date();

  return {

    //----------------------------------------------------------
    // IDENTIFICATION
    //----------------------------------------------------------

    CARD_ID:

      KGMIS_CreateCardId_(person),

    FAMILY_ID:

      person.familyId,

    KEFG_ID:

      person.kefgId || "",

    CARDHOLDER_TYPE:

      KGMIS_GetCardholderType_(person),

    RELATION_SEQUENCE:

      KGMIS_GetMemberSequence_(person),

    CARDHOLDER_NAME:

      person.memberName,

    //----------------------------------------------------------
    // MEMBERSHIP
    //----------------------------------------------------------

    MEMBERSHIP_TYPE:

      membershipRecord.membershipType,

    MEMBERSHIP_YEAR:

      membershipRecord.financialYear,

    MEMBERSHIP_STATUS:

      membershipRecord.membershipStatus,

    //----------------------------------------------------------
    // CARD VALIDITY
    //----------------------------------------------------------

    ISSUE_DATE:

      now,

    VALID_UNTIL:

    KGMIS_GetCardValidityDate_(

      membershipRecord.financialYear

    ),
    
    CARD_STATUS:

      KGMIS_CONFIG
        .CARD_STATUS
        .ACTIVE,

    CARD_STATE:

      KGMIS_CONFIG
        .CARD_STATE
        .GENERATED,

    //----------------------------------------------------------
    // CONTACT
    //----------------------------------------------------------

    MEMBER_MOBILE:

      person.mobile || "",

    MEMBER_EMAIL:

      person.email || "",

    //----------------------------------------------------------
    // PHOTO
    //----------------------------------------------------------

    PHOTO_FILE_ID:

      person.photo || "",

    PHOTO_URL:

      "",

    //----------------------------------------------------------
    // QR
    //----------------------------------------------------------

    QR_TOKEN:

      KGMIS_CreateQrToken_(),

    //----------------------------------------------------------
    // GENERATED FILES
    //----------------------------------------------------------

    CARD_PDF_FILE_ID:

      "",

    CARD_PDF_FILE_URL:

      "",

    CARD_IMAGE_FILE_ID:

      "",

    CARD_IMAGE_FILE_URL:

      "",

    //----------------------------------------------------------
    // AUDIT
    //----------------------------------------------------------

    CREATED_ON:

      now,

    CREATED_BY:

      Session.getActiveUser().getEmail(),

    UPDATED_ON:

      "",

    UPDATED_BY:

      "",

    //----------------------------------------------------------
    // VERSION
    //----------------------------------------------------------

    CARD_VERSION:

      KGMIS_CONFIG.CARD_VERSION,

    LAST_VERIFIED_ON:

      "",

    REMARKS:

      ""

  };

}

/**
 * ============================================================
 * SAFE TEST
 * CARD RECORD BUILDER
 * ============================================================
 */

function KGMIS_TestCreateCardRecord(){

  const person = {

    source:
      KGMIS_CONFIG
        .SOURCE_TYPE
        .MEMBER,

    familyId:
      "FAM00035",

    kefgId:
      "KEFG1001",

    memberCategory:
      "PRIMARY MEMBER",

    memberName:
      "Test Member",

    mobile:
      "9999999999",

    email:
      "test@test.com",

    photo:
      ""

  };

  const membership = {

    financialYear:
      "2026-27",

    membershipType:
      "FAMILY",

    membershipStatus:
      "CURRENT"

  };

  const card =

    KGMIS_CreateCardRecord_(

      person,

      membership

    );

  Logger.log(

    JSON.stringify(

      card,

      null,

      2

    )

  );

}
