/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * DIGITAL MEMBERSHIP CARD GENERATOR
 * Designed and Developed by James Joseph Alenchery
 * ============================================================
 *
 * File    : old name 34.02A_KGMIS_Digital_Card_Generator.gs
 * Version : 1.0
 *
 * PURPOSE
 * -------
 * Enterprise Digital Membership Card generation engine.
 *
 * This module:
 *
 * 1. Reads the CURRENT financial year.
 * 2. Identifies eligible paid families.
 * 3. Builds the complete eligible cardholder list.
 * 4. Generates deterministic Card Numbers.
 * 5. Creates or updates records in KEFG_MEMBER_CARDS.
 *
 * AUTHORITATIVE SHEETS
 * --------------------
 *
 * KGMIS_FINANCIAL_YEAR
 * KGMIS_MEMBERSHIP_YEAR
 * KGMIS_MASTER_DATABASE_v1.0
 * KEFG_FAMILY_MEMBERS
 * KGMIS_DEPENDANTS
 * KEFG_MEMBER_CARDS
 *
 * IMPORTANT
 * ---------
 * This file does not render the Digital Membership Card.
 * It only builds and maintains the card records.
 *
 * ============================================================
 */


/**
 * ============================================================
 * SECTION 1
 * CONFIGURATION
 * ============================================================
 */

const KGMIS_DIGITAL_CARD_ENGINE_CONFIG =
Object.freeze({

  //----------------------------------------------------------
  // SHEET NAMES
  //----------------------------------------------------------

  SHEETS:
    Object.freeze({

      FINANCIAL_YEAR:
        "KGMIS_FINANCIAL_YEAR",

      MEMBERSHIP_YEAR:
        "KGMIS_MEMBERSHIP_YEAR",

      MASTER_DATABASE:
        "KGMIS_MASTER_DATABASE_v1.0",

      FAMILY_MEMBERS:
        "KEFG_FAMILY_MEMBERS",

      DEPENDANTS:
        "KGMIS_DEPENDANTS",

      MEMBER_CARDS:
        "KEFG_MEMBER_CARDS"

    }),

  //----------------------------------------------------------
  // ID PREFIXES
  //----------------------------------------------------------

  PREFIX:
    Object.freeze({

      FAMILY:
        "FAM",

      CARD:
        "KEFG",

      QR:
        "KGMIS-"

    }),

  //----------------------------------------------------------
  // SOURCE TYPES
  //----------------------------------------------------------

  SOURCE_TYPE:
    Object.freeze({

      MEMBER:
        "MEMBER",

      DEPENDANT:
        "DEPENDANT"

    }),

  //----------------------------------------------------------
  // MEMBERSHIP STATUS
  //----------------------------------------------------------

  MEMBERSHIP_STATUS:
    Object.freeze({

      CURRENT:
        "CURRENT",

      ACTIVE:
        "ACTIVE",

      EXTENDED:
        "EXTENDED",

      LIFE_TIME:
        "LIFE TIME",

      INACTIVE:
        "INACTIVE",

      DORMANT:
        "DORMANT",

      SUSPENDED:
        "SUSPENDED"

    }),

  //----------------------------------------------------------
  // PAYMENT STATUS
  //----------------------------------------------------------

  PAYMENT_STATUS:
    Object.freeze({

      PAID:
        "PAID"

    }),

  //----------------------------------------------------------
  // RECORD STATUS
  //----------------------------------------------------------

  RECORD_STATUS:
    Object.freeze({

      ACTIVE:
        "ACTIVE",

      INACTIVE:
        "INACTIVE"

    }),

  //----------------------------------------------------------
  // OFFICIAL CARDHOLDER TYPES
  //----------------------------------------------------------

  CARDHOLDER_TYPE:
    Object.freeze({

      PRIMARY_MEMBER:
        "PRIMARY MEMBER",

      MEMBER:
        "MEMBER",

      DEPENDENT:
        "FAMILY"

    }),

  //----------------------------------------------------------
  // CARD STATUS
  //----------------------------------------------------------

  CARD_STATUS:
    Object.freeze({

      ACTIVE:
        "ACTIVE",

      REVOKED:
        "REVOKED"

    }),

  //----------------------------------------------------------
  // CARD STATE
  //----------------------------------------------------------

  CARD_STATE:
    Object.freeze({

      CURRENT:
        "CURRENT",

      EXTENDED:
        "EXTENDED",

      REVOKED:
        "REVOKED"

    }),

  //----------------------------------------------------------
  // RESERVED RELATION SEQUENCES
  //----------------------------------------------------------

  RELATION_SEQUENCE:
    Object.freeze({

      PRIMARY_MEMBER:
        "01",

      SPOUSE:
        "02",

      MINIMUM_DEPENDANT:
        3,

      MAXIMUM:
        99

    }),

  //----------------------------------------------------------
  // SYSTEM USER
  //----------------------------------------------------------

  SYSTEM_USER:
    "KGMIS_SYSTEM"

});


/**
 * ============================================================
 * SAFE TEST
 * SECTION 1 CONFIGURATION
 * ============================================================
 */

function KGMIS_TestDigitalCardEngineConfiguration() {

  const config =
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG;

  const result = {

    success:
      true,

    sheets:
      config.SHEETS,

    prefixes:
      config.PREFIX,

    sourceTypes:
      config.SOURCE_TYPE,

    membershipStatuses:
      config.MEMBERSHIP_STATUS,

    cardholderTypes:
      config.CARDHOLDER_TYPE,

    relationSequence:
      config.RELATION_SEQUENCE

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
 * SECTION 2
 * SHEET CONTEXT ENGINE
 * ============================================================
 *
 * Every sheet is accessed through a Context object.
 *
 * A Context contains:
 *
 * sheet
 * headers
 * headerMap
 * lastRow
 * lastColumn
 *
 * ============================================================
 */


/**
 * ============================================================
 * CREATE SHEET CONTEXT
 * ============================================================
 */

function KGMIS_CreateSheetContext_(

  sheetName,

  requiredHeaders

){

  const ss =

    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =

    ss.getSheetByName(

      sheetName

    );

  if(!sheet){

    throw new Error(

      "Sheet not found : " +

      sheetName

    );

  }

  const lastColumn =

    sheet.getLastColumn();

  if(lastColumn===0){

    throw new Error(

      sheetName +

      " contains no headers."

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

      .map(function(header){

        return String(header)

          .trim();

      });

  const headerMap = {};

  headers.forEach(function(

    header,

    index

  ){

    headerMap[header]=index;

  });

  //----------------------------------------------------------
  // Validate Required Headers
  //----------------------------------------------------------

  if(

    Array.isArray(

      requiredHeaders

    )

  ){

    requiredHeaders.forEach(function(

      header

    ){

      if(

        headerMap[header]===undefined

      ){

        throw new Error(

          sheetName +

          " missing required header : " +

          header

        );

      }

    });

  }

  return{

    sheet:

      sheet,

    headers:

      headers,

    headerMap:

      headerMap,

    lastRow:

      sheet.getLastRow(),

    lastColumn:

      lastColumn

  };

}


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestCreateSheetContext(){

  const context =

    KGMIS_CreateSheetContext_(

      KGMIS_DIGITAL_CARD_ENGINE_CONFIG
        .SHEETS
        .MASTER_DATABASE,

      [

        "KEFG_ID",

        "FAMILY_ID",

        "MEMBER_NAME"

      ]

    );

  const result={

    success:true,

    sheet:

      context.sheet.getName(),

    rows:

      context.lastRow,

    columns:

      context.lastColumn,

    headers:

      context.headers.length

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
 * SECTION 3
 * STANDARD CONTEXT WRAPPERS
 * ============================================================
 *
 * Every module obtains sheet access through these wrappers.
 *
 * No other section should directly call
 * KGMIS_CreateSheetContext_().
 *
 * ============================================================
 */


/**
 * ============================================================
 * MASTER DATABASE
 * ============================================================
 */

function KGMIS_GetMasterDatabaseContext_(){

  return KGMIS_CreateSheetContext_(

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .MASTER_DATABASE,

    [

      "KEFG_ID",

      "FAMILY_ID",

      "RELATED_MEMBER_KEFG_ID",

      "MEMBER_CATEGORY",

      "RECORD_STATUS",

      "MEMBER_NAME",

      "TYPE_OF_MEMBERSHIP",

      "MEMBER_MOBILE",

      "MEMBER_EMAIL",

      "PHOTO"

    ]

  );

}


/**
 * ============================================================
 * MEMBERSHIP YEAR
 * ============================================================
 */

function KGMIS_My_GetMembershipYearContext_(){

  return KGMIS_CreateSheetContext_(

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .MEMBERSHIP_YEAR,

    [

      "MEMBERSHIP_YEAR_KEY",

      "FAMILY_ID",

      "FINANCIAL_YEAR",

      "MEMBERSHIP_TYPE",

      "MEMBERSHIP_STATUS",

      "PAYMENT_STATUS",

      "RECORD_STATUS"

    ]

  );

}

/**
 * ============================================================
 * FINANCIAL YEAR
 * ============================================================
 */

function KGMIS_Get_Card_FinancialYearContext__(){

  return KGMIS_CreateSheetContext_(

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .FINANCIAL_YEAR,

    [

      "FINANCIAL_YEAR",

      "START_DATE",

      "END_DATE",

      "GRACE_PERIOD_END",

      "STATUS",

      "CARD_VERSION"

    ]

  );

}

/**
 * ============================================================
 * FAMILY MEMBERS / DEPENDANTS
 * ============================================================
 */

function KGMIS_GetFamilyMembersContext_() {

  return KGMIS_CreateSheetContext_(

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .FAMILY_MEMBERS,

    [
      "DEPENDANT_ID",
      "FAMILY_ID",
      "FULL_NAME",
      "FAMILY_RELATION",
      "RELATION_SEQUENCE",
      "CARD_ELIGIBLE",
      "RECORD_STATUS"
    ]

  );

}


/**
 * ============================================================
 * DEPENDANTS
 * ============================================================
 */

function KGMIS_GetDependantsContext_(){

  return KGMIS_CreateSheetContext_(

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .DEPENDANTS,

    [

      "KEFG_DEPENDANT_ID",

      "FAMILY_ID",

      "DEPENDANT_TYPE",

      "DEPENDANT_SEQUENCE",

      "NAME",

      "RECORD_STATUS"

    ]

  );

}


/**
 * ============================================================
 * DIGITAL CARD TABLE
 * ============================================================
 */

function KGMIS_GetMemberCardsContext_(){

  return KGMIS_CreateSheetContext_(

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .MEMBER_CARDS,

    [

      "CARD_ID"

    ]

  );

}


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestAllContexts(){

  const result={

    success:true,

    master:

      KGMIS_GetMasterDatabaseContext_()
        .sheet
        .getName(),

    membershipYear:

      KGMIS_GetMembershipYearContext_()
        .sheet
        .getName(),

    financialYear:

      KGMIS_Get_Card_FinancialYearContext__()
        .sheet
        .getName(),

    familyMembers:

      KGMIS_GetFamilyMembersContext_()
        .sheet
        .getName(),

    dependants:

      KGMIS_GetDependantsContext_()
        .sheet
        .getName(),

    cards:

      KGMIS_GetMemberCardsContext_()
        .sheet
        .getName()

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
 * SECTION 4
 * CURRENT FINANCIAL YEAR ENGINE
 * ============================================================
 *
 * The Digital Card Generator NEVER receives a Financial Year
 * as a parameter.
 *
 * It always reads the single CURRENT row from
 * KGMIS_FINANCIAL_YEAR.
 *
 * ============================================================
 */


/**
 * ============================================================
 * READ CURRENT FINANCIAL YEAR
 * ============================================================
 */

function KGMIS_GetCurrentFinancialYear_(){

  const context =

    KGMIS_Get_Card_FinancialYearContext__();

  const values =

    context.sheet
      .getDataRange()
      .getValues();

  const map =
    context.headerMap;

  const currentRows=[];

  for(

    let r=1;

    r<values.length;

    r++

  ){

    const row=values[r];

    const status=

      String(

        row[map["STATUS"]]||""

      )

      .trim()

      .toUpperCase();

    if(

      status==="CURRENT"

    ){

      currentRows.push({

        financialYear:

          String(

            row[map["FINANCIAL_YEAR"]]

          ).trim(),

        startDate:

          row[map["START_DATE"]],

        endDate:

          row[map["END_DATE"]],

        gracePeriodEnd:

          row[map["GRACE_PERIOD_END"]],

        cardVersion:

          String(

            row[map["CARD_VERSION"]]

          ).trim()

      });

    }

  }

  //----------------------------------------------------------
  // Validation
  //----------------------------------------------------------

  if(currentRows.length===0){

    throw new Error(

      'No row with STATUS = "CURRENT" found.'

    );

  }

  if(currentRows.length>1){

    throw new Error(

      'More than one CURRENT Financial Year exists.'

    );

  }

  const current=

    currentRows[0];

  //----------------------------------------------------------
  // Validate Financial Year
  //----------------------------------------------------------

  if(!current.financialYear){

    throw new Error(

      "FINANCIAL_YEAR is blank."

    );

  }

  //----------------------------------------------------------
  // Validate Dates
  //----------------------------------------------------------

  if(

    !(current.startDate instanceof Date)

  ){

    throw new Error(

      "Invalid START_DATE."

    );

  }

  if(

    !(current.endDate instanceof Date)

  ){

    throw new Error(

      "Invalid END_DATE."

    );

  }

  if(

    !(current.gracePeriodEnd instanceof Date)

  ){

    throw new Error(

      "Invalid GRACE_PERIOD_END."

    );

  }

  //----------------------------------------------------------
  // Validate Card Version
  //----------------------------------------------------------

  if(

    current.cardVersion===""

  ){

    throw new Error(

      "CARD_VERSION is blank."

    );

  }

  return current;

}


/**
 * ============================================================
 * MEMBERSHIP STATUS NORMALIZER
 * ============================================================
 *
 * Temporary compatibility layer.
 *
 * CURRENT
 * ↓
 * ACTIVE
 *
 * ============================================================
 */

function KGMIS_NormalizeMembershipStatus_(status){

  status=

    String(status||"")

      .trim()

      .toUpperCase()

      .replace(/\s+/g," ");

  switch(status){

    case "CURRENT":
      return "ACTIVE";

    case "LIFETIME":
    case "LIFE-TIME":
      return "LIFE TIME";

    default:
      return status;

  }

}


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestCurrentFinancialYear(){

  const current=

    KGMIS_GetCurrentFinancialYear_();

  Logger.log(

    JSON.stringify(

      current,

      null,

      2

    )

  );

  return current;

}


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestMembershipStatusNormalization(){

  const values=[

    "CURRENT",

    "ACTIVE",

    "EXTENDED",

    "LIFE TIME",

    "LIFETIME",

    "LIFE-TIME",

    "INACTIVE",

    "DORMANT",

    "SUSPENDED"

  ];

  const result=

    values.map(function(value){

      return{

        input:value,

        output:

          KGMIS_NormalizeMembershipStatus_(

            value

          )

      };

    });

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
 * SECTION 5
 * MEMBERSHIP ELIGIBILITY ENGINE
 * ============================================================
 *
 * Returns every eligible FAMILY_ID for the CURRENT
 * Financial Year.
 *
 * Eligibility Rules
 * -----------------
 *
 * FINANCIAL_YEAR = Current Financial Year
 * RECORD_STATUS  = ACTIVE
 * PAYMENT_STATUS = PAID
 * MEMBERSHIP_STATUS =
 *      CURRENT
 *      ACTIVE
 *      EXTENDED
 *      LIFE TIME
 *
 * CURRENT is normalized to ACTIVE.
 *
 * ============================================================
 */


/**
 * ============================================================
 * READ ELIGIBLE FAMILIES
 * ============================================================
 */

function KGMIS_GetEligibleFamilies_(){

  const currentFY =

    KGMIS_GetCurrentFinancialYear_();

  const context =

    KGMIS_GetMembershipYearContext_();

  const values =

    context.sheet
      .getDataRange()
      .getValues();

  const map =
    context.headerMap;

  const families=[];

  const duplicateCheck={};

  const eligibleStatus=[

    "ACTIVE",

    "EXTENDED",

    "LIFE TIME"

  ];

  for(

    let r=1;

    r<values.length;

    r++

  ){

    const row=values[r];

    //----------------------------------------------------------
    // Financial Year
    //----------------------------------------------------------

    const financialYear=

      String(

        row[map["FINANCIAL_YEAR"]]||""

      ).trim();

    if(

      financialYear!==

      currentFY.financialYear

    ){

      continue;

    }

    //----------------------------------------------------------
    // Record Status
    //----------------------------------------------------------

    const recordStatus=

      String(

        row[map["RECORD_STATUS"]]||""

      )

      .trim()

      .toUpperCase();

    if(

      recordStatus!=="ACTIVE"

    ){

      continue;

    }

    //----------------------------------------------------------
    // Payment Status
    //----------------------------------------------------------

    const paymentStatus=

      String(

        row[map["PAYMENT_STATUS"]]||""

      )

      .trim()

      .toUpperCase();

    if(

      paymentStatus!=="PAID"

    ){

      continue;

    }

    //----------------------------------------------------------
    // Membership Status
    //----------------------------------------------------------

    const storedStatus=

      String(

        row[map["MEMBERSHIP_STATUS"]]||""

      );

    const membershipStatus=

      KGMIS_NormalizeMembershipStatus_(

        storedStatus

      );

    if(

      !eligibleStatus.includes(

        membershipStatus

      )

    ){

      continue;

    }

    //----------------------------------------------------------
    // Family ID
    //----------------------------------------------------------

    const familyId=

      String(

        row[map["FAMILY_ID"]]||""

      )

      .trim()

      .toUpperCase();

    if(

      familyId===""

    ){

      continue;

    }

    //----------------------------------------------------------
    // Duplicate Check
    //----------------------------------------------------------

    if(

      duplicateCheck[familyId]

    ){

      throw new Error(

        "Duplicate Membership Year record found for "

        + familyId

      );

    }

    duplicateCheck[familyId]=true;

    //----------------------------------------------------------
    // Eligible Record
    //----------------------------------------------------------

    families.push({

      membershipYearKey:

        String(

          row[map["MEMBERSHIP_YEAR_KEY"]]||""

        ).trim(),

      familyId:

        familyId,

      financialYear:

        currentFY.financialYear,

      membershipType:

        String(

          row[map["MEMBERSHIP_TYPE"]]||""

        ).trim(),

      membershipStatus:

        membershipStatus,

      paymentStatus:

        paymentStatus,

      recordStatus:

        recordStatus,

      startDate:

        currentFY.startDate,

      endDate:

        currentFY.endDate,

      gracePeriodEnd:

        currentFY.gracePeriodEnd,

      cardVersion:

        currentFY.cardVersion

    });

  }

  return families;

}


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestEligibleFamilies(){

  const families=

    KGMIS_GetEligibleFamilies_();

  Logger.log(

    JSON.stringify(

      {

        eligibleFamilies:

          families.length,

        firstFamily:

          families.length

          ?

          families[0]

          :

          null

      },

      null,

      2

    )

  );

  return families;

}

/**
 * ============================================================
 * SECTION 6
 * UNIFIED PERSON OBJECT
 * ============================================================
 *
 * Every person processed by the Digital Card Generator is first
 * converted into this standard object.
 *
 * The remaining sections of the generator NEVER read directly
 * from any sheet.
 *
 * They only work with Person Objects.
 *
 * ============================================================
 */


/**
 * ============================================================
 * CREATE EMPTY PERSON OBJECT
 * ============================================================
 */

function KGMIS_CreatePersonObject_(){

  return {

    //----------------------------------------------------------
    // Identity
    //----------------------------------------------------------

    source : "",

    familyId : "",

    kefgId : "",

    dependantId : "",

    //----------------------------------------------------------
    // Personal
    //----------------------------------------------------------

    fullName : "",

    mobile : "",

    email : "",

    photo : "",

    //----------------------------------------------------------
    // Classification
    //----------------------------------------------------------

    memberCategory : "",

    familyRelation : "",

    cardholderType : "",

    //----------------------------------------------------------
    // Sequences
    //----------------------------------------------------------

    relationSequence : "",

    dependantSequence : "",

    //----------------------------------------------------------
    // Membership
    //----------------------------------------------------------

    membershipType : "",

    membershipStatus : "",

    paymentStatus : "",

    recordStatus : "",

    //----------------------------------------------------------
    // Card
    //----------------------------------------------------------

    cardEligible : false,

    cardId : "",

    cardVersion : "",

    //----------------------------------------------------------
    // Audit
    //----------------------------------------------------------

    sourceSheet : ""

  };

}


/**
 * ============================================================
 * VALIDATE PERSON OBJECT
 * ============================================================
 */

function KGMIS_ValidatePersonObject_(person){

  if(!person){

    throw new Error(

      "Person object is required."

    );

  }

  if(!person.familyId){

    throw new Error(

      "Missing FAMILY_ID."

    );

  }

  if(!person.fullName){

    throw new Error(

      "Missing Person Name."

    );

  }

  if(

    person.cardEligible &&

    !person.relationSequence

  ){

    throw new Error(

      "Missing RELATION_SEQUENCE for "

      + person.fullName

    );

  }

  return true;

}


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestPersonObject(){

  const person =

    KGMIS_CreatePersonObject_();

  person.familyId="FAM00035";

  person.fullName="Test Person";

  person.relationSequence="01";

  person.cardEligible=true;

  Logger.log(

    JSON.stringify(

      person,

      null,

      2

    )

  );

  Logger.log(

    KGMIS_ValidatePersonObject_(

      person

    )

  );

  return person;

}

/**
 * ============================================================
 * SECTION 7
 * MASTER DATABASE ADAPTER
 * ============================================================
 *
 * Reads all Master Database records belonging to one FAMILY_ID.
 *
 * MEMBER_CATEGORY identifies whether the person is:
 *
 * PRIMARY MEMBER
 * ALUMNI SPOUSE MEMBER
 * NON-ALUMNI SPOUSE
 *
 * Family membership eligibility has already been determined
 * by Section 5 using KGMIS_MEMBERSHIP_YEAR.
 *
 * This adapter does not apply membership-year business rules.
 *
 * ============================================================
 */


/**
 * ============================================================
 * LOAD MASTER PERSONS
 * ============================================================
 */

function KGMIS_GetMasterPersons_(eligibleFamily) {

  if (!eligibleFamily) {

    throw new Error(
      "Eligible Family object is required."
    );

  }

  const normalizedFamilyId =
    String(
      eligibleFamily.familyId || ""
    )
      .trim()
      .toUpperCase();

  if (!normalizedFamilyId) {

    throw new Error(
      "FAMILY_ID is required."
    );

  }

  const context =
    KGMIS_GetMasterDatabaseContext_();

  const values =
    context.sheet
      .getDataRange()
      .getValues();

  const map =
    context.headerMap;

  const persons = [];

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];

    const rowFamilyId =
      String(
        row[map["FAMILY_ID"]] || ""
      )
        .trim()
        .toUpperCase();

    if (
      rowFamilyId !==
      normalizedFamilyId
    ) {

      continue;

    }

    const person =
      KGMIS_CreatePersonFromMasterRow_(
        row,
        map
      );

      person.membershipType =
        eligibleFamily.membershipType || "";

      person.membershipStatus =
        eligibleFamily.membershipStatus || "";

      person.paymentStatus =
        eligibleFamily.paymentStatus || "";

      person.recordStatus =
        eligibleFamily.recordStatus || "";

      person.cardVersion =
        eligibleFamily.cardVersion || "";

    KGMIS_ValidatePersonObject_(
      person
    );

    persons.push(
      person
    );

  }

  return KGMIS_SortMasterPersons_(
    persons
  );

}


/**
 * ============================================================
 * CREATE PERSON FROM MASTER DATABASE ROW
 * ============================================================
 */

function KGMIS_CreatePersonFromMasterRow_(
  row,
  map
) {

  const person =
    KGMIS_CreatePersonObject_();

  //----------------------------------------------------------
  // Source
  //----------------------------------------------------------

  person.source =
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SOURCE_TYPE
      .MEMBER;

  person.sourceSheet =
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .MASTER_DATABASE;

  //----------------------------------------------------------
  // Identity
  //----------------------------------------------------------

  person.familyId =
    String(
      row[map["FAMILY_ID"]] || ""
    )
      .trim()
      .toUpperCase();

  person.kefgId =
    String(
      row[map["KEFG_ID"]] || ""
    ).trim();

  //----------------------------------------------------------
  // Personal Details
  //----------------------------------------------------------

  person.fullName =
    String(
      row[map["MEMBER_NAME"]] || ""
    ).trim();

  person.mobile =
    String(
      row[map["MEMBER_MOBILE"]] || ""
    ).trim();

  person.email =
    String(
      row[map["MEMBER_EMAIL"]] || ""
    ).trim();

  person.photo =
    String(
      row[map["PHOTO"]] || ""
    ).trim();

  //----------------------------------------------------------
  // Classification
  //----------------------------------------------------------

    person.memberCategory =
  KGMIS_NormalizeMasterMemberCategory_(
    row[map["MEMBER_CATEGORY"]]
  );

  //----------------------------------------------------------
  // Temporary Master Classification
  //
  // Section 8 will merge the authoritative relation details
  // from KEFG_FAMILY_MEMBERS.
  //----------------------------------------------------------

  switch (person.memberCategory) {

    case "PRIMARY MEMBER":

      person.familyRelation =
        "PRIMARY MEMBER";

      person.relationSequence =
        KGMIS_DIGITAL_CARD_ENGINE_CONFIG
          .RELATION_SEQUENCE
          .PRIMARY_MEMBER;

      person.cardEligible =
        true;

      break;

    case "ALUMNI SPOUSE MEMBER":

    case "NON-ALUMNI SPOUSE":

      person.familyRelation =
        "SPOUSE";

      person.relationSequence =
        KGMIS_DIGITAL_CARD_ENGINE_CONFIG
          .RELATION_SEQUENCE
          .SPOUSE;

      person.cardEligible =
        true;

      break;

    default:

      person.familyRelation =
        "";

      person.relationSequence =
        "";

      person.cardEligible =
        false;

  }

  return person;

}


/**
 * ============================================================
 * NORMALIZE MASTER MEMBER CATEGORY
 * ============================================================
 */

function KGMIS_NormalizeMasterMemberCategory_(
  category
) {

  const normalized =
    String(category || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

  switch (normalized) {

    case "PRIMARY MEMBER":

      return "PRIMARY MEMBER";

    case "ALUMNI SPOUSE":

    case "ALUMNI SPOUSE MEMBER":

      return "ALUMNI SPOUSE MEMBER";

    case "NON-ALUMNI SPOUSE":

    case "NON ALUMNI SPOUSE":

    case "NON-ALUMNI SPOUSE MEMBER":

    case "NON ALUMNI SPOUSE MEMBER":

      return "NON-ALUMNI SPOUSE";

    default:

      return normalized;

  }

}


/**
 * ============================================================
 * SORT MASTER PERSONS
 * ============================================================
 */

function KGMIS_SortMasterPersons_(persons) {

  const order = {

    "PRIMARY MEMBER":
      1,

    "ALUMNI SPOUSE MEMBER":
      2,

    "NON-ALUMNI SPOUSE":
      2

  };

  return persons.sort(function(a, b) {

    const orderA =
      order[a.memberCategory] || 99;

    const orderB =
      order[b.memberCategory] || 99;

    if (orderA !== orderB) {

      return orderA - orderB;

    }

    return String(a.fullName || "")
      .localeCompare(
        String(b.fullName || "")
      );

  });

}


/**
 * ============================================================
 * SAFE TEST
 * MASTER DATABASE ADAPTER
 * ============================================================
 */

function KGMIS_TestMasterDatabaseAdapter(
  familyId
) {

  const testFamilyId =
    String(
      familyId || "FAM00035"
    )
      .trim()
      .toUpperCase();

  const eligibleFamily =
    KGMIS_GetEligibleFamilies_()
    .find(function(family){

      return String(family.familyId)
        .trim()
        .toUpperCase()

        ===

        testFamilyId;

    });

  if (!eligibleFamily) {

  throw new Error(
    testFamilyId +
    " is not an eligible family."
  );

}

  const persons =
    KGMIS_GetMasterPersons_(
      eligibleFamily
    );

  const primaryMembers =  
    persons.filter(function(person) {

      return (
        person.memberCategory ===
        "PRIMARY MEMBER"
      );

    });

  const spouses =
    persons.filter(function(person) {

      return (
        person.memberCategory ===
          "ALUMNI SPOUSE MEMBER"

        ||

        person.memberCategory ===
          "NON-ALUMNI SPOUSE"
      );

    });

  const summary = {

    success:
      persons.length > 0,

    familyId:
      testFamilyId,

    personsFound:
      persons.length,

    primaryMembers:
      primaryMembers.length,

    spouses:
      spouses.length,

    classifications:
      persons.map(function(person) {

        return {

          kefgId:
            person.kefgId,

          fullName:
            person.fullName,

          memberCategory:
            person.memberCategory,

          familyRelation:
            person.familyRelation,

          relationSequence:
            person.relationSequence,

          cardEligible:
            person.cardEligible

        };

      })

  };

  Logger.log(
    "================================="
  );

  Logger.log(
    "MASTER DATABASE ADAPTER"
  );

  Logger.log(
    "================================="
  );

  Logger.log(
    JSON.stringify(
      summary,
      null,
      2
    )
  );

  Logger.log(
    "================================="
  );

  Logger.log(
    "COMPLETE PERSON OBJECTS"
  );

  Logger.log(
    "================================="
  );

  Logger.log(
    JSON.stringify(
      persons,
      null,
      2
    )
  );

  if (persons.length === 0) {

    throw new Error(
      "No Master Database records found for " +
      testFamilyId +
      "."
    );

  }

  if (primaryMembers.length === 0) {

    throw new Error(
      "No PRIMARY MEMBER found for " +
      testFamilyId +
      "."
    );

  }

  if (primaryMembers.length > 1) {

    throw new Error(
      "More than one PRIMARY MEMBER found for " +
      testFamilyId +
      "."
    );

  }

  Logger.log(
    "Validation : PASS"
  );

  return summary;

}

/**
 * ============================================================
 * SECTION 8
 * DEPENDENT CARD ADAPTER
 * ============================================================
 *
 * AUTHORITATIVE SOURCES
 * ---------------------
 *
 * Primary Member and Spouse:
 * KGMIS_MASTER_DATABASE_v1.0
 *
 * Dependents:
 * KEFG_FAMILY_MEMBERS
 *
 * FAMILY PAYMENT CONDITION
 * ------------------------
 *
 * The family must first be eligible through:
 *
 * KGMIS_MEMBERSHIP_YEAR
 *
 * PAYMENT_STATUS    = PAID
 * RECORD_STATUS     = ACTIVE
 * MEMBERSHIP_STATUS = ACTIVE / EXTENDED / LIFE TIME
 *
 * Dependents are loaded only when:
 *
 * FAMILY_ID matches the eligible family
 * RECORD_STATUS is ACTIVE or blank
 * CARD_ELIGIBLE is YES / TRUE
 *
 * Dependents are identified by
 * DEPENDANT_ID
 * They do not receive a KEFG_ID.
 *
 * ============================================================
 */


/**
 * ============================================================
 * GET COMPLETE FAMILY PERSONS
 * ============================================================
 *
 * Receives:
 *
 * eligibleFamily
 *      Eligible-family object returned by Section 5.
 *
 * masterPersons
 *      Primary Member and Spouse Person Objects returned
 *      by Section 7.
 *
 * Returns:
 *
 * Primary Member
 * Spouse
 * Card-eligible Dependents
 *
 * ============================================================
 */

function KGMIS_GetCompleteFamilyPersons_(
  eligibleFamily,
  masterPersons
) {

  //----------------------------------------------------------
  // Validate Eligible Family
  //----------------------------------------------------------

  KGMIS_ValidateEligibleFamilyForCards_(
    eligibleFamily
  );

  if (!Array.isArray(masterPersons)) {

    throw new Error(
      "Master Person array is required."
    );

  }

  const familyId =
    String(
      eligibleFamily.familyId || ""
    )
      .trim()
      .toUpperCase();

  //----------------------------------------------------------
  // Start with Primary Member and Spouse
  //----------------------------------------------------------

  const persons =
    masterPersons.slice();

  //----------------------------------------------------------
  // Ensure Master Persons belong to the same FAMILY_ID
  //----------------------------------------------------------

  persons.forEach(function(person) {

    const personFamilyId =
      String(
        person.familyId || ""
      )
        .trim()
        .toUpperCase();

    if (personFamilyId !== familyId) {

      throw new Error(
        "Master person " +
        person.fullName +
        " does not belong to " +
        familyId +
        "."
      );

    }

  });

  //----------------------------------------------------------
  // Existing sequence protection
  //----------------------------------------------------------

  const usedSequences = {};

  persons.forEach(function(person) {

    const sequence =
      String(
        person.relationSequence || ""
      ).trim();

    if (sequence) {

      usedSequences[sequence] =
        person.fullName || "Master Member";

    }

  });

  //----------------------------------------------------------
  // Duplicate dependent protection
  //----------------------------------------------------------

  const dependentKeys = {};

  //----------------------------------------------------------
  // Read KEFG_FAMILY_MEMBERS
  //----------------------------------------------------------

  const context =
    KGMIS_GetFamilyMembersContext_();

  const values =
    context.sheet
      .getDataRange()
      .getValues();

  const map =
    context.headerMap;

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];

    //--------------------------------------------------------
    // FAMILY_ID
    //--------------------------------------------------------

    const rowFamilyId =
      String(
        row[map["FAMILY_ID"]] || ""
      )
        .trim()
        .toUpperCase();

    if (rowFamilyId !== familyId) {

      continue;

    }

    //--------------------------------------------------------
    // RECORD_STATUS
    //
    // Blank is temporarily accepted as ACTIVE.
    //--------------------------------------------------------

    const recordStatus =
      String(
        row[map["RECORD_STATUS"]] || ""
      )
        .trim()
        .toUpperCase();

    if (
      recordStatus &&
      recordStatus !==
        KGMIS_DIGITAL_CARD_ENGINE_CONFIG
          .RECORD_STATUS
          .ACTIVE
    ) {

      continue;

    }

    //--------------------------------------------------------
    // CARD_ELIGIBLE
    //--------------------------------------------------------

    const cardEligible =
      KGMIS_ParseDependentCardEligible_(
        row[map["CARD_ELIGIBLE"]]
      );

    if (!cardEligible) {

      continue;

    }

    //--------------------------------------------------------
    // FULL_NAME
    //--------------------------------------------------------

    const fullName =
      String(
        row[map["FULL_NAME"]] || ""
      ).trim();

    if (!fullName) {

      throw new Error(
        "FULL_NAME is blank for a card-eligible dependent " +
        "in " +
        familyId +
        " at sheet row " +
        (rowIndex + 1) +
        "."
      );

    }

    //--------------------------------------------------------
    // FAMILY_RELATION
    //--------------------------------------------------------

    const familyRelation =
      KGMIS_NormalizeDependentRelation_(
        row[map["FAMILY_RELATION"]]
      );

    if (!familyRelation) {

      throw new Error(
        "FAMILY_RELATION is blank for " +
        fullName +
        " in " +
        familyId +
        "."
      );

    }

    //--------------------------------------------------------
    // RELATION_SEQUENCE
    //--------------------------------------------------------

    const relationSequence =
      KGMIS_NormalizeDependentSequence_(
        row[map["RELATION_SEQUENCE"]],
        fullName
      );

    //--------------------------------------------------------
    // Duplicate Sequence Protection
    //--------------------------------------------------------

    if (usedSequences[relationSequence]) {

      throw new Error(
        "Duplicate RELATION_SEQUENCE " +
        relationSequence +
        " found for " +
        fullName +
        ". Already used by " +
        usedSequences[relationSequence] +
        "."
      );

    }

    //--------------------------------------------------------
    // Duplicate Dependent Protection
    //--------------------------------------------------------

    const dependentKey =
      KGMIS_CreateDependentKey_(
        familyId,
        fullName,
        relationSequence
      );

    if (dependentKeys[dependentKey]) {

      throw new Error(
        "Duplicate dependent record found for " +
        fullName +
        " in " +
        familyId +
        "."
      );

    }


//--------------------------------------------------------
// DEPENDANT_ID
//--------------------------------------------------------

const dependantId =
  String(
    row[map["DEPENDANT_ID"]] || ""
  )
    .trim()
    .toUpperCase();

if (!dependantId) {

  throw new Error(
    "DEPENDANT_ID is blank for " +
    fullName +
    " in " +
    familyId +
    "."
  );

}

//--------------------------------------------------------
// Create Dependent Person
//--------------------------------------------------------

const dependentPerson =
  KGMIS_CreateDependentPerson_(

    eligibleFamily,

    {

      dependantId:
        dependantId,

      fullName:
        fullName,

      familyRelation:
        familyRelation,

      relationSequence:
        relationSequence,

      recordStatus:
        recordStatus || "ACTIVE",

      cardEligible:
        true

    }

  );



    KGMIS_ValidatePersonObject_(
      dependentPerson
    );

    persons.push(
      dependentPerson
    );

    usedSequences[relationSequence] =
      fullName;

    dependentKeys[dependentKey] =
      true;

  }

    const completeFamily =

      KGMIS_SortCompleteFamilyPersons_(

        persons

      );

    return{

        eligibleFamily:

        eligibleFamily,

          persons:

        completeFamily

      };

}


/**
 * ============================================================
 * VALIDATE ELIGIBLE FAMILY
 * ============================================================
 */

function KGMIS_ValidateEligibleFamilyForCards_(
  eligibleFamily
) {

  if (!eligibleFamily) {

    throw new Error(
      "Eligible Family object is required."
    );

  }

  const familyId =
    String(
      eligibleFamily.familyId || ""
    )
      .trim()
      .toUpperCase();

  if (!familyId) {

    throw new Error(
      "Eligible Family is missing FAMILY_ID."
    );

  }

  const paymentStatus =
    String(
      eligibleFamily.paymentStatus || ""
    )
      .trim()
      .toUpperCase();

  if (
    paymentStatus !==
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .PAYMENT_STATUS
      .PAID
  ) {

    throw new Error(
      familyId +
      " is not eligible because PAYMENT_STATUS is not PAID."
    );

  }

  const recordStatus =
    String(
      eligibleFamily.recordStatus || ""
    )
      .trim()
      .toUpperCase();

  if (
    recordStatus !==
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .RECORD_STATUS
      .ACTIVE
  ) {

    throw new Error(
      familyId +
      " is not eligible because the Membership Year record " +
      "is not ACTIVE."
    );

  }

  const membershipStatus =
    KGMIS_NormalizeMembershipStatus_(
      eligibleFamily.membershipStatus
    );

  const eligibleStatuses = [
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .MEMBERSHIP_STATUS
      .ACTIVE,

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .MEMBERSHIP_STATUS
      .EXTENDED,

    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .MEMBERSHIP_STATUS
      .LIFE_TIME
  ];

  if (
    !eligibleStatuses.includes(
      membershipStatus
    )
  ) {

    throw new Error(
      familyId +
      " has an ineligible MEMBERSHIP_STATUS: " +
      membershipStatus
    );

  }

  if (!eligibleFamily.financialYear) {

    throw new Error(
      familyId +
      " is missing FINANCIAL_YEAR."
    );

  }

  return true;

}

/**
 * ============================================================
 * CREATE DEPENDENT PERSON OBJECT
 * ============================================================
 */

function KGMIS_CreateDependentPerson_(
  eligibleFamily,
  dependentData
) {

  const person =
    KGMIS_CreatePersonObject_();

  //----------------------------------------------------------
  // Source
  //----------------------------------------------------------

  person.source =
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SOURCE_TYPE
      .DEPENDANT;

  person.sourceSheet =
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SHEETS
      .FAMILY_MEMBERS;

  //----------------------------------------------------------
  // Identity
  //----------------------------------------------------------

  person.familyId =
    String(
      eligibleFamily.familyId || ""
    )
      .trim()
      .toUpperCase();

  /*
   * Dependants do not have a KEFG_ID.
   *
   * Future versions will generate:
   *
   * DEP0003501
   * DEP0003502
   *
   * For now it remains blank.
   */

  person.kefgId = "";

  person.dependantId =
  dependentData.dependantId || "";

  //----------------------------------------------------------
  // Personal Details
  //----------------------------------------------------------

  person.fullName =
    dependentData.fullName;

  //----------------------------------------------------------
  // Classification
  //----------------------------------------------------------

  person.memberCategory =
    "DEPENDENT";

  person.familyRelation =
    dependentData.familyRelation;

  person.relationSequence =
    dependentData.relationSequence;

  person.dependantSequence =
    dependentData.relationSequence;

  //----------------------------------------------------------
  // Membership
  //----------------------------------------------------------

  person.membershipType =
    eligibleFamily.membershipType || "";

  person.membershipStatus =
    eligibleFamily.membershipStatus || "";

  person.paymentStatus =
    eligibleFamily.paymentStatus || "";

  person.recordStatus =
    dependentData.recordStatus || "ACTIVE";

  //----------------------------------------------------------
  // Card
  //----------------------------------------------------------

  person.cardEligible =
    dependentData.cardEligible === true;

  person.cardVersion =
    eligibleFamily.cardVersion || "";

  return person;

}

/**
 * ============================================================
 * PARSE CARD_ELIGIBLE
 * ============================================================
 */

function KGMIS_ParseDependentCardEligible_(
  value
) {

  if (value === true) {

    return true;

  }

  if (value === false) {

    return false;

  }

  const normalized =
    String(value || "")
      .trim()
      .toUpperCase();

  return [
    "YES",
    "Y",
    "TRUE",
    "1",
    "ELIGIBLE"
  ].includes(normalized);

}


/**
 * ============================================================
 * NORMALIZE DEPENDENT RELATION
 * ============================================================
 */

function KGMIS_NormalizeDependentRelation_(
  relation
) {

  return String(relation || "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

}


/**
 * ============================================================
 * NORMALIZE DEPENDENT RELATION SEQUENCE
 * ============================================================
 */

function KGMIS_NormalizeDependentSequence_(
  sequence,
  fullName
) {

  const rawSequence =
    String(sequence || "")
      .trim();

  if (!rawSequence) {

    throw new Error(
      "RELATION_SEQUENCE is blank for dependent " +
      fullName +
      "."
    );

  }

  const numericSequence =
    Number(rawSequence);

  if (
    !Number.isInteger(numericSequence)
  ) {

    throw new Error(
      "RELATION_SEQUENCE must be a whole number for " +
      fullName +
      ". Received: " +
      sequence
    );

  }

  const minimumSequence =
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .RELATION_SEQUENCE
      .MINIMUM_DEPENDANT;

  const maximumSequence =
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .RELATION_SEQUENCE
      .MAXIMUM;

  if (
    numericSequence < minimumSequence ||
    numericSequence > maximumSequence
  ) {

    throw new Error(
      "Dependent RELATION_SEQUENCE for " +
      fullName +
      " must be between " +
      minimumSequence +
      " and " +
      maximumSequence +
      "."
    );

  }

  return Utilities.formatString(
    "%02d",
    numericSequence
  );

}


/**
 * ============================================================
 * CREATE DEPENDENT DUPLICATE KEY
 * ============================================================
 */

function KGMIS_CreateDependentKey_(
  familyId,
  fullName,
  relationSequence
) {

  return [

    String(familyId || "")
      .trim()
      .toUpperCase(),

    String(fullName || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " "),

    String(relationSequence || "")
      .trim()

  ].join("|");

}


/**
 * ============================================================
 * SORT COMPLETE FAMILY PERSONS
 * ============================================================
 */

function KGMIS_SortCompleteFamilyPersons_(
  persons
) {

  return persons.sort(function(a, b) {

    const sequenceA =
      Number(
        a.relationSequence || 999
      );

    const sequenceB =
      Number(
        b.relationSequence || 999
      );

    if (sequenceA !== sequenceB) {

      return sequenceA - sequenceB;

    }

    return String(a.fullName || "")
      .localeCompare(
        String(b.fullName || "")
      );

  });

}


/**
 * ============================================================
 * SAFE TEST
 * COMPLETE FAMILY BUNDLE
 * ============================================================
 */

function KGMIS_TestCompleteFamilyBundle(
  familyId
){

  familyId=

    familyId ||

    "FAM00035";

  //----------------------------------------------------------
  // Get Eligible Family
  //----------------------------------------------------------

  const eligibleFamily=

    KGMIS_GetEligibleFamilies_()

      .find(function(f){

        return(

          String(f.familyId)

            .trim()

            .toUpperCase()

          ===

          String(familyId)

            .trim()

            .toUpperCase()

        );

      });

  if(!eligibleFamily){

    throw new Error(

      familyId +

      " is not an eligible PAID family."

    );

  }

  //----------------------------------------------------------
  // Load Member + Spouse
  //----------------------------------------------------------

  const masterPersons=

    KGMIS_GetMasterPersons_(

      familyId

    );

  //----------------------------------------------------------
  // Build Family Bundle
  //----------------------------------------------------------

  const familyBundle=

    KGMIS_GetCompleteFamilyPersons_(

      eligibleFamily,

      masterPersons

    );

  //----------------------------------------------------------
  // Populate Membership Information
  //
  // Applies to every cardholder.
  //----------------------------------------------------------

  familyBundle.persons.forEach(function(person){

    person.membershipType=

      eligibleFamily.membershipType;

    person.membershipStatus=

      eligibleFamily.membershipStatus;

    person.paymentStatus=

      eligibleFamily.paymentStatus;

    person.cardVersion=

      eligibleFamily.cardVersion;

  });

  //----------------------------------------------------------
  // Summary
  //----------------------------------------------------------

  const summary={

    success:true,

    familyId:

      eligibleFamily.familyId,

    financialYear:

      eligibleFamily.financialYear,

    paymentStatus:

      eligibleFamily.paymentStatus,

    membershipStatus:

      eligibleFamily.membershipStatus,

    persons:

      familyBundle.persons.length

  };

  Logger.log(

    "================================"

  );

  Logger.log(

    "COMPLETE FAMILY BUNDLE"

  );

  Logger.log(

    "================================"

  );

  Logger.log(

    JSON.stringify(

      summary,

      null,

      2

    )

  );

  Logger.log(

    "================================"

  );

  Logger.log(

    "ELIGIBLE FAMILY"

  );

  Logger.log(

    "================================"

  );

  Logger.log(

    JSON.stringify(

      familyBundle.eligibleFamily,

      null,

      2

    )

  );

  Logger.log(

    "================================"

  );

  Logger.log(

    "PERSON OBJECTS"

  );

  Logger.log(

    "================================"

  );

  Logger.log(

    JSON.stringify(

      familyBundle.persons,

      null,

      2

    )

  );

  Logger.log("");

  Logger.log(

    "Validation : PASS"

  );

  return familyBundle;

}


/**
 * ============================================================
 * SECTION 9
 * CARDHOLDER TYPE RESOLVER
 * ============================================================
 *
 * Converts MEMBER_CATEGORY into the official
 * Digital Membership Card holder type.
 *
 * ============================================================
 */


/**
 * ============================================================
 * RESOLVE CARDHOLDER TYPES
 * ============================================================
 */

function KGMIS_ResolveCardholderTypes_(
  familyBundle
){

  if(!familyBundle){

    throw new Error(
      "Family Bundle is required."
    );

  }

  if(!Array.isArray(familyBundle.persons)){

    throw new Error(
      "Family Bundle contains no Person Objects."
    );

  }

  familyBundle.persons.forEach(function(person){

    person.cardholderType =

      KGMIS_GetCardholderType_(person);

  });

  return familyBundle;

}


/**
 * ============================================================
 * GET CARDHOLDER TYPE
 * ============================================================
 */

function KGMIS_GetCardholderType_(person) {

  if (!person) {

    throw new Error(
      "Person Object is required."
    );

  }

  const source =
    String(person.source || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

  const memberCategory =
    String(person.memberCategory || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

  //----------------------------------------------------------
  // Dependants
  //----------------------------------------------------------

  if (
    source ===
    KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .SOURCE_TYPE
      .DEPENDANT
  ) {

    return KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .CARDHOLDER_TYPE
      .DEPENDENT;

  }

  //----------------------------------------------------------
  // Primary Member
  //----------------------------------------------------------

  if (
    memberCategory === "PRIMARY MEMBER"
  ) {

    return KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .CARDHOLDER_TYPE
      .PRIMARY_MEMBER;

  }

  //----------------------------------------------------------
  // Alumni Spouse Member
  //
  // Frozen rule:
  // Alumni Spouse Member is also a Primary Member.
  //----------------------------------------------------------

  if (
    memberCategory === "ALUMNI SPOUSE" ||
    memberCategory === "ALUMNI SPOUSE MEMBER"
  ) {

    return KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .CARDHOLDER_TYPE
      .PRIMARY_MEMBER;

  }

  //----------------------------------------------------------
  // Non-Alumni Spouse
  //----------------------------------------------------------

  const nonAlumniSpouseCategories = [

    "NON-ALUMNI SPOUSE",

    "NON ALUMNI SPOUSE",

    "NON-ALUMNI SPOUSE MEMBER",

    "NON ALUMNI SPOUSE MEMBER"

  ];

  if (
    nonAlumniSpouseCategories.includes(
      memberCategory
    )
  ) {

    return KGMIS_DIGITAL_CARD_ENGINE_CONFIG
      .CARDHOLDER_TYPE
      .MEMBER;

  }

  //----------------------------------------------------------
  // Unknown Category
  //----------------------------------------------------------

  throw new Error(
    "Unknown MEMBER_CATEGORY : " +
    person.memberCategory
  );

}


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestCardholderTypes(
  familyId
){

  familyId=

    familyId ||

    "FAM00035";

  //----------------------------------------------------------
  // Eligible Family
  //----------------------------------------------------------

  const eligibleFamily=

    KGMIS_GetEligibleFamilies_()

      .find(function(f){

        return(

          String(f.familyId)

            .trim()

            .toUpperCase()

          ===

          String(familyId)

            .trim()

            .toUpperCase()

        );

      });

  if(!eligibleFamily){

    throw new Error(

      familyId +

      " is not an eligible family."

    );

  }

  //----------------------------------------------------------
  // Build Family Bundle
  //----------------------------------------------------------

  const masterPersons=

    KGMIS_GetMasterPersons_(

      familyId

    );

  const familyBundle=

    KGMIS_GetCompleteFamilyPersons_(

      eligibleFamily,

      masterPersons

    );

  familyBundle.persons.forEach(function(person){

    person.membershipType=

      eligibleFamily.membershipType;

    person.membershipStatus=

      eligibleFamily.membershipStatus;

    person.paymentStatus=

      eligibleFamily.paymentStatus;

    person.cardVersion=

      eligibleFamily.cardVersion;

  });

  //----------------------------------------------------------
  // Resolve Types
  //----------------------------------------------------------

  KGMIS_ResolveCardholderTypes_(

    familyBundle

  );

  //----------------------------------------------------------
  // Output
  //----------------------------------------------------------

  const summary={

    success:true,

    familyId:

      familyBundle.eligibleFamily.familyId,

    persons:

      familyBundle.persons.map(function(person){

        return{

          fullName:

            person.fullName,

          memberCategory:

            person.memberCategory,

          familyRelation:

            person.familyRelation,

          cardholderType:

            person.cardholderType

        };

      })

  };

  Logger.log(

    "================================"

  );

  Logger.log(

    "CARDHOLDER TYPE RESOLVER"

  );

  Logger.log(

    "================================"

  );

  Logger.log(

    JSON.stringify(

      summary,

      null,

      2

    )

  );

  Logger.log(

    "Validation : PASS"

  );

  return familyBundle;

}

/**
 * ============================================================
 * SECTION 10
 * FAMILY BUILDER
 * ============================================================
 *
 * PURPOSE
 * -------
 * Combines:
 *
 * 1. Eligible Family                - Section 5
 * 2. Master Member / Spouse Persons - Section 7
 * 3. Dependants                     - Section 8
 * 4. Cardholder Types               - Section 9
 *
 * OUTPUT
 * ------
 * cardGenerationBundle
 *
 * {
 *   success,
 *   familyId,
 *   financialYear,
 *   cardVersion,
 *   eligibleFamily,
 *   persons
 * }
 *
 * This section does not:
 *
 * - Check payment independently
 * - Read dependant records independently
 * - Generate Card IDs
 * - Generate QR codes
 * - Render or print cards
 *
 * ============================================================
 */


/**
 * ============================================================
 * BUILD CARD GENERATION BUNDLE
 * ============================================================
 */

function KGMIS_BuildCardGenerationBundle_(eligibleFamily) {

  //----------------------------------------------------------
  // Validate Eligible Family Input
  //----------------------------------------------------------

  if (!eligibleFamily) {

    return {

      success: false,

      familyId: "",

      message:
        "Eligible Family object is required.",

      eligibleFamily: null,

      persons: []

    };

  }


  const familyId =
    String(
      eligibleFamily.familyId || ""
    )
      .trim()
      .toUpperCase();


  if (!familyId) {

    return {

      success: false,

      familyId: "",

      message:
        "Eligible Family is missing FAMILY_ID.",

      eligibleFamily:
        eligibleFamily,

      persons: []

    };

  }


  try {

    //--------------------------------------------------------
    // Section 7
    // Load Primary Member and Spouse Persons
    //--------------------------------------------------------

    const masterPersons =
      KGMIS_GetMasterPersons_(
        eligibleFamily
      );


    if (!Array.isArray(masterPersons)) {

      throw new Error(
        "Master Database Adapter did not return a persons array."
      );

    }


    if (masterPersons.length === 0) {

      throw new Error(
        "No Primary Member or Spouse records were found for " +
        familyId +
        "."
      );

    }


    //--------------------------------------------------------
    // Section 8
    // Add Card-Eligible Dependants
    //--------------------------------------------------------

    const completeFamilyBundle =
      KGMIS_GetCompleteFamilyPersons_(

        eligibleFamily,

        masterPersons

      );


    if (
      !completeFamilyBundle ||
      !Array.isArray(
        completeFamilyBundle.persons
      )
    ) {

      throw new Error(
        "Dependent Card Adapter did not return a valid family bundle."
      );

    }


    //--------------------------------------------------------
    // Section 9
    // Resolve Cardholder Types
    //--------------------------------------------------------

const cardholderResult =
  KGMIS_ResolveCardholderTypes_(
    completeFamilyBundle
  );

if (
  !cardholderResult ||
  !Array.isArray(cardholderResult.persons)
) {

  throw new Error(
    "Cardholder Type Resolver did not return a valid family bundle."
  );

}

const resolvedPersons =
  cardholderResult.persons;

    /*
     * Section 9 may return either:
     *
     * persons[]
     *
     * or
     *
     * {
     *   success: true,
     *   familyId: "...",
     *   persons: [...]
     * }
     *
     * The following supports both formats.
     * this part Deleted
     */


    //--------------------------------------------------------
    // Sort Persons by Relation Sequence
    //--------------------------------------------------------

    const sortedPersons =
      resolvedPersons
        .slice()
        .sort(function(a, b) {

          const sequenceA =
            Number(
              a.relationSequence || 999
            );

          const sequenceB =
            Number(
              b.relationSequence || 999
            );


          if (
            sequenceA !==
            sequenceB
          ) {

            return (
              sequenceA -
              sequenceB
            );

          }


          return String(
            a.fullName || ""
          ).localeCompare(
            String(
              b.fullName || ""
            )
          );

        });


    //--------------------------------------------------------
    // Validate Final Persons
    //--------------------------------------------------------

    if (sortedPersons.length === 0) {

      throw new Error(
        "No cardholders were found for " +
        familyId +
        "."
      );

    }


    sortedPersons.forEach(
      function(person) {

        KGMIS_ValidatePersonObject_(
          person
        );

      }
    );


    //--------------------------------------------------------
    // Build Card Generation Bundle
    //--------------------------------------------------------

    const cardGenerationBundle = {

      success: true,

      familyId:
        familyId,

      financialYear:
        eligibleFamily.financialYear || "",

      cardVersion:
        eligibleFamily.cardVersion || "",

      eligibleFamily:
        eligibleFamily,

      persons:
        sortedPersons

    };


    return cardGenerationBundle;

  }


  catch (error) {

    return {

      success: false,

      familyId:
        familyId,

      financialYear:
        eligibleFamily.financialYear || "",

      cardVersion:
        eligibleFamily.cardVersion || "",

      message:
        error &&
        error.message

          ? error.message

          : String(error),

      eligibleFamily:
        eligibleFamily,

      persons: []

    };

  }

}


/**
 * ============================================================
 * SAFE TEST
 * SECTION 10
 * CARD GENERATION BUNDLE
 * ============================================================
 */

function KGMIS_TestCardGenerationBundle(
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
    "CARD GENERATION BUNDLE"
  );

  Logger.log(
    "================================"
  );


  //----------------------------------------------------------
  // Section 5
  // Get Eligible Families
  //----------------------------------------------------------

  const eligibleFamilies =
    KGMIS_GetEligibleFamilies_();


  if (
    !Array.isArray(
      eligibleFamilies
    )
  ) {

    throw new Error(
      "Eligibility Engine did not return an array."
    );

  }


  Logger.log(
    "Eligible Families Found : " +
    eligibleFamilies.length
  );


  //----------------------------------------------------------
  // Find Test Family
  //----------------------------------------------------------

  const eligibleFamily =
    eligibleFamilies.find(
      function(family) {

        return (

          String(
            family.familyId || ""
          )
            .trim()
            .toUpperCase()

          ===

          testFamilyId

        );

      }
    );


  if (!eligibleFamily) {

    Logger.log(
      "Test Family Not Found : " +
      testFamilyId
    );

    Logger.log(
      "Validation : FAIL"
    );

    return {

      success: false,

      familyId:
        testFamilyId,

      message:
        testFamilyId +
        " is not an eligible PAID family."

    };

  }


  Logger.log(
    "Test Family Found : " +
    eligibleFamily.familyId
  );


  //----------------------------------------------------------
  // Build Card Generation Bundle
  //----------------------------------------------------------

  const cardGenerationBundle =
    KGMIS_BuildCardGenerationBundle_(

      eligibleFamily

    );


  //----------------------------------------------------------
  // Display Complete Result
  //----------------------------------------------------------

  Logger.log(
    JSON.stringify(
      cardGenerationBundle,
      null,
      2
    )
  );


  //----------------------------------------------------------
  // Display Person Summary
  //----------------------------------------------------------

  if (
    cardGenerationBundle.success
  ) {

    Logger.log(
      "================================"
    );

    Logger.log(
      "CARDHOLDERS"
    );

    Logger.log(
      "================================"
    );


    cardGenerationBundle.persons
      .forEach(
        function(person, index) {

          Logger.log(

            Utilities.formatString(
              "%02d",
              index + 1
            )

            + " | " +

            String(
              person.fullName || ""
            )

            + " | " +

            String(
              person.cardholderType || ""
            )

            + " | Sequence: " +

            String(
              person.relationSequence || ""
            )

          );

        }
      );

  }


  Logger.log(
    "Validation : " +
    (
      cardGenerationBundle.success
        ? "PASS"
        : "FAIL"
    )
  );


  return cardGenerationBundle;

}



