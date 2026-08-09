/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Digital Membership Card Generator
 *
 * File : 34.02_KGMIS_Digital_Card_Generator.gs
 * Version : 1.0
 * Developed by : James Joseph Alenchery  
 *
 * ============================================================
 *
 * PURPOSE
 * ------------------------------------------------------------
 * This module is the ONLY component responsible for creating
 * and maintaining records in KEFG_MEMBER_CARDS.
 *
 * Responsibilities:
 *
 * ✓ Read KGMIS_MASTER_DATABASE_v1.0
 * ✓ Read KGMIS_MEMBERSHIP_YEAR
 * ✓ Read KGMIS_FINANCIAL_YEAR
 * ✓ Generate new Digital Cards
 * ✓ Update existing Digital Cards
 * ✓ Calculate card validity
 * ✓ Determine Card Status & Card State
 * ✓ Generate QR Tokens
 * ✓ Maintain Card Version
 *
 * NOTE
 * ------------------------------------------------------------
 * The Renderer (34.01) NEVER creates or updates cards.
 * It only displays existing cards.
 *
 * ============================================================
 */


/**
 * ============================================================
 * PART 1
 * CONFIGURATION
 * ============================================================
 */

const KGMIS_DIGITAL_CARD_GENERATOR_CONFIG =
Object.freeze({

  //------------------------------------------------------------
  // Sheet Names
  //------------------------------------------------------------

  MASTER_DATABASE_SHEET:
    'KGMIS_MASTER_DATABASE_v1.0',

  MEMBERSHIP_YEAR_SHEET:
    'KGMIS_MEMBERSHIP_YEAR',

  FINANCIAL_YEAR_SHEET:
    'KGMIS_FINANCIAL_YEAR',

  DIGITAL_CARD_SHEET:
    'KEFG_MEMBER_CARDS',

  FAMILY_MEMBERS_SHEET:
    'KEFG_FAMILY_MEMBERS',

  DEPENDANTS_SHEET:
    'KGMIS_DEPENDANTS',

  //------------------------------------------------------------
  // Card Prefix
  //------------------------------------------------------------

  CARD_PREFIX:
    'KEFG',

  FAMILY_PREFIX:
    'FAM',

  //------------------------------------------------------------
  // Default Values
  //------------------------------------------------------------

  DEFAULT_CARD_VERSION:
    '1.0',

  DEFAULT_CARD_STATUS:
    'ACTIVE',

  DEFAULT_CARD_STATE:
    'CURRENT',

  DEFAULT_CARDHOLDER_TYPE:
    'PRIMARY_MEMBER',

  //------------------------------------------------------------
  // Supported Membership Types
  //------------------------------------------------------------

  MEMBERSHIP_TYPES:
    Object.freeze([
      'ANNUAL',
      'LIFE'
    ]),

  //------------------------------------------------------------
  // Card Status
  //------------------------------------------------------------

  CARD_STATUS:
    Object.freeze({

      ACTIVE:
        'ACTIVE',

      REVOKED:
        'REVOKED'

    }),

  //------------------------------------------------------------
  // Card State
  //------------------------------------------------------------

  CARD_STATE:
    Object.freeze({

      CURRENT:
        'CURRENT',

      EXTENDED:
        'EXTENDED',

      REVOKED:
        'REVOKED'

    }),

  //------------------------------------------------------------
  // System User
  //------------------------------------------------------------

  SYSTEM_USER:
    'KGMIS_SYSTEM'

});


/**
 * ============================================================
 * SAFE TEST
 * Generator Configuration
 * ============================================================
 */

function KGMIS_TestDigitalCardGeneratorConfiguration() {

  const config =
    KGMIS_DIGITAL_CARD_GENERATOR_CONFIG;

  const result = {

    success: true,

    masterDatabase:
      config.MASTER_DATABASE_SHEET,

    membershipYear:
      config.MEMBERSHIP_YEAR_SHEET,

    financialYear:
      config.FINANCIAL_YEAR_SHEET,

    cardSheet:
      config.DIGITAL_CARD_SHEET,

    cardPrefix:
      config.CARD_PREFIX,

    defaultVersion:
      config.DEFAULT_CARD_VERSION,

    defaultStatus:
      config.DEFAULT_CARD_STATUS,

    defaultState:
      config.DEFAULT_CARD_STATE

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
 * PART 2
 * GENERATOR CONTEXT ENGINE
 * ============================================================
 *
 * Creates reusable sheet contexts for the
 * Digital Card Generator.
 *
 * Every context contains:
 *
 * sheet
 * headers
 * headerMap
 * lastRow
 *
 * ============================================================
 */

function KGMIS_Generator_GetSheetContext_(
  sheetName,
  requiredHeaders
){

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(sheetName);

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
      .getDisplayValues()[0];

  const headerMap = {};

  headers.forEach(function(header,index){

    headerMap[
      String(header).trim()
    ] = index;

  });

  if(requiredHeaders){

    requiredHeaders.forEach(function(header){

      if(headerMap[header]===undefined){

        throw new Error(

          sheetName +

          " missing required header : " +

          header

        );

      }

    });

  }

  return {

    sheet:
      sheet,

    headers:
      headers,

    headerMap:
      headerMap,

    lastRow:
      sheet.getLastRow()

  };

}


/**
 * ============================================================
 * MASTER DATABASE CONTEXT
 * ============================================================
 */

function KGMIS_GetMasterDatabaseContext_(){

  return KGMIS_Generator_GetSheetContext_(

    KGMIS_DIGITAL_CARD_GENERATOR_CONFIG
      .MASTER_DATABASE_SHEET,

    [

      "KEFG_ID",

      "FAMILY_ID",

      "MEMBER_NAME",

      "PHOTO"

    ]

  );

}


/**
 * ============================================================
 * MEMBERSHIP YEAR CONTEXT
 * ============================================================
 */

function KGMIS_Card_GetMembershipYearContext_() {

  return KGMIS_Generator_GetSheetContext_(

    KGMIS_DIGITAL_CARD_GENERATOR_CONFIG
      .MEMBERSHIP_YEAR_SHEET,

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
 * FINANCIAL YEAR CONTEXT
 * ============================================================
 */

function KGMIS_Generator_GetFinancialYearContext_() {

  return KGMIS_Generator_GetSheetContext_(

    KGMIS_DIGITAL_CARD_GENERATOR_CONFIG
      .FINANCIAL_YEAR_SHEET,

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
 * GET CURRENT FINANCIAL YEAR
 * ============================================================
 *
 * Reads the single row where:
 *
 * STATUS = CURRENT
 *
 * Returns the current financial-year configuration.
 *
 * ============================================================
 */

function KGMIS_GetCurrentFinancialYear_() {

  const context =
    KGMIS_Generator_GetFinancialYearContext_();

  const values =
    context.sheet
      .getDataRange()
      .getValues();

  const map =
    context.headerMap;

  const currentRows = [];

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];

    const status =
      String(
        row[map["STATUS"]] || ""
      )
        .trim()
        .toUpperCase();

    if (status !== "CURRENT") {
      continue;
    }

    currentRows.push({

      rowNumber:
        rowIndex + 1,

      financialYear:
        String(
          row[map["FINANCIAL_YEAR"]] || ""
        ).trim(),

      startDate:
        row[map["START_DATE"]],

      endDate:
        row[map["END_DATE"]],

      gracePeriodEnd:
        row[map["GRACE_PERIOD_END"]],

      cardVersion:
        String(
          row[map["CARD_VERSION"]] || ""
        ).trim()

    });

  }

  if (currentRows.length === 0) {

    throw new Error(
      'No row with STATUS = "CURRENT" was found in ' +
      "KGMIS_FINANCIAL_YEAR."
    );

  }

  if (currentRows.length > 1) {

    throw new Error(
      "More than one CURRENT financial year was found in " +
      "KGMIS_FINANCIAL_YEAR."
    );

  }

  const currentYear =
    currentRows[0];

  if (!currentYear.financialYear) {

    throw new Error(
      "FINANCIAL_YEAR is blank in the CURRENT financial-year row."
    );

  }

  if (
    !(currentYear.startDate instanceof Date) ||
    isNaN(currentYear.startDate.getTime())
  ) {

    throw new Error(
      "Invalid START_DATE for current Financial Year " +
      currentYear.financialYear +
      "."
    );

  }

  if (
    !(currentYear.endDate instanceof Date) ||
    isNaN(currentYear.endDate.getTime())
  ) {

    throw new Error(
      "Invalid END_DATE for current Financial Year " +
      currentYear.financialYear +
      "."
    );

  }

  if (
    !(currentYear.gracePeriodEnd instanceof Date) ||
    isNaN(currentYear.gracePeriodEnd.getTime())
  ) {

    throw new Error(
      "Invalid GRACE_PERIOD_END for current Financial Year " +
      currentYear.financialYear +
      "."
    );

  }

  if (!currentYear.cardVersion) {

    throw new Error(
      "CARD_VERSION is blank for current Financial Year " +
      currentYear.financialYear +
      "."
    );

  }

  return currentYear;

}

/**
 * ============================================================
 * NORMALIZE CARD MEMBERSHIP STATUS
 * ============================================================
 *
 * CURRENT is temporarily treated as ACTIVE.
 *
 * Future supported values:
 *
 * ACTIVE
 * EXTENDED
 * LIFE TIME
 * INACTIVE
 * DORMANT
 * SUSPENDED
 *
 * ============================================================
 */

function KGMIS_NormalizeCardMembershipStatus_(status) {

  const normalizedStatus =
    String(status || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");

  //----------------------------------------------------------
  // CURRENT SYSTEM COMPATIBILITY
  //----------------------------------------------------------

  if (normalizedStatus === "CURRENT") {

    return "ACTIVE";

  }

  //----------------------------------------------------------
  // LIFE TIME COMPATIBILITY
  //----------------------------------------------------------

  if (
    normalizedStatus === "LIFETIME" ||
    normalizedStatus === "LIFE-TIME"
  ) {

    return "LIFE TIME";

  }

  return normalizedStatus;

}


/**
 * ============================================================
 * SAFE TEST
 * MEMBERSHIP STATUS NORMALIZER
 * ============================================================
 */

function KGMIS_TestNormalizeCardMembershipStatus() {

  const tests = [

    ["CURRENT", "ACTIVE"],

    ["ACTIVE", "ACTIVE"],

    ["EXTENDED", "EXTENDED"],

    ["LIFE TIME", "LIFE TIME"],

    ["LIFETIME", "LIFE TIME"],

    ["INACTIVE", "INACTIVE"],

    ["DORMANT", "DORMANT"],

    ["SUSPENDED", "SUSPENDED"]

  ];

  const results =
    tests.map(function(test) {

      const actual =
        KGMIS_NormalizeCardMembershipStatus_(
          test[0]
        );

      return {

        input:
          test[0],

        expected:
          test[1],

        actual:
          actual,

        passed:
          actual === test[1]

      };

    });

  Logger.log(
    JSON.stringify(
      results,
      null,
      2
    )
  );

  return results;

}

/**
 * ============================================================
 * SAFE TEST
 * CURRENT FINANCIAL YEAR
 * ============================================================
 */

function KGMIS_TestCurrentFinancialYear() {

  const result =
    KGMIS_GetCurrentFinancialYear_();

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
 * DIGITAL CARD CONTEXT
 * ============================================================
 */

function KGMIS_GetDigitalCardContext_(){

  return KGMIS_Generator_GetSheetContext_(

    KGMIS_DIGITAL_CARD_GENERATOR_CONFIG
      .DIGITAL_CARD_SHEET,

    [

      "CARD_ID",

      "KEFG_ID",

      "MEMBERSHIP_YEAR"

    ]

  );

}


/**
 * ============================================================
 * SAFE TEST
 * MASTER DATABASE
 * ============================================================
 */

function KGMIS_TestGeneratorMasterDatabase(){

  const context =
    KGMIS_GetMasterDatabaseContext_();

  const result = {

    success:true,

    sheet:
      context.sheet.getName(),

    headerCount:
      context.headers.length,

    lastRow:
      context.lastRow

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
 * SAFE TEST
 * MEMBERSHIP YEAR
 * ============================================================
 */

function KGMIS_TestGeneratorMembershipYear(){

  const context =
    KGMIS_Card_GetMembershipYearContext_();

  const result = {

    success:true,

    sheet:
      context.sheet.getName(),

    headerCount:
      context.headers.length,

    lastRow:
      context.lastRow

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
 * SAFE TEST
 * FINANCIAL YEAR
 * ============================================================
 */

function KGMIS_TestGeneratorFinancialYear(){

  const context =
    KGMIS_Generator_GetFinancialYearContext_();

  const result = {

    success:true,

    sheet:
      context.sheet.getName(),

    headerCount:
      context.headers.length,

    lastRow:
      context.lastRow

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
 * SAFE TEST
 * DIGITAL CARD SHEET
 * ============================================================
 */

function KGMIS_TestGeneratorDigitalCardSheet(){

  const context =
    KGMIS_GetDigitalCardContext_();

  const result = {

    success:true,

    sheet:
      context.sheet.getName(),

    headerCount:
      context.headers.length,

    lastRow:
      context.lastRow

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
 * PART 3A
 * DIGITAL CARD GENERATION ENGINE
 * ============================================================
 *
 * Generates or updates Digital Membership Cards
 * for one Financial Year.
 *
 * Workflow
 *
 * Membership Year
 *        │
 *        ▼
 * Eligible Families
 *        │
 *        ▼
 * Master Database Members
 *        │
 *        ▼
 * Existing Card ?
 *        │
 *   ┌────┴────┐
 *   │         │
 * Update    Create
 *   │         │
 *   └────┬────┘
 *        ▼
 * Save Card Record
 *
 * ============================================================
 */


/**
 * ============================================================
 * PUBLIC ENTRY POINT
 * ============================================================
 */

function KGMIS_GenerateMembershipCards(financialYear){

  if(!financialYear){

    throw new Error(
      "Financial Year is required."
    );

  }

  const families =
    KGMIS_GetEligibleFamilies_();

  const statistics = {

    success:true,

    financialYear:financialYear,

    familiesProcessed:0,

    membersProcessed:0,

    cardsCreated:0,

    cardsUpdated:0,

    skipped:0

  };

  families.forEach(function(family){

    statistics.familiesProcessed++;

    const members =
      KGMIS_GetFamilyMembers_(
        family.familyId
      );

    members.forEach(function(member){

      statistics.membersProcessed++;

      const existingCard =
        KGMIS_FindExistingCard_(

          member.kefgId,

          financialYear

        );

      if(existingCard){

        KGMIS_UpdateDigitalCard_(

          existingCard,

          member,

          family

        );

        statistics.cardsUpdated++;

      }else{

        KGMIS_CreateDigitalCard_(

          member,

          family

        );

        statistics.cardsCreated++;

      }

    });

  });

  Logger.log(

    JSON.stringify(

      statistics,

      null,

      2

    )

  );

  return statistics;

}

/**
 * ============================================================
 * GET ELIGIBLE FAMILIES
 * ============================================================
 *
 * Enterprise Digital Card workflow.
 *
 * Reads:
 * - Current Financial Year from KGMIS_FINANCIAL_YEAR
 * - Eligible family membership records from KGMIS_MEMBERSHIP_YEAR
 *
 * Eligibility:
 * - FINANCIAL_YEAR = current financial year
 * - RECORD_STATUS = ACTIVE
 * - PAYMENT_STATUS = PAID
 * - MEMBERSHIP_STATUS = CURRENT / ACTIVE / EXTENDED / LIFE TIME
 *
 * CURRENT is temporarily normalized to ACTIVE.
 *
 * ============================================================
 */

function KGMIS_GetEligibleFamilies_() {

  const currentFY =
    KGMIS_GetCurrentFinancialYear_();

  const context =
    KGMIS_Card_GetMembershipYearContext_();

  const values =
    context.sheet
      .getDataRange()
      .getValues();

  const map =
    context.headerMap;

  const eligibleFamilies = [];

  const seenFamilyIds = {};

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];

    //--------------------------------------------------------
    // FINANCIAL YEAR
    //--------------------------------------------------------

    const financialYear =
      String(
        row[map["FINANCIAL_YEAR"]] || ""
      ).trim();

    if (
      financialYear !==
      currentFY.financialYear
    ) {
      continue;
    }

    //--------------------------------------------------------
    // RECORD STATUS
    //--------------------------------------------------------

    const recordStatus =
      String(
        row[map["RECORD_STATUS"]] || ""
      )
        .trim()
        .toUpperCase();

    if (recordStatus !== "ACTIVE") {
      continue;
    }

    //--------------------------------------------------------
    // PAYMENT STATUS
    //--------------------------------------------------------

    const paymentStatus =
      String(
        row[map["PAYMENT_STATUS"]] || ""
      )
        .trim()
        .toUpperCase();

    if (paymentStatus !== "PAID") {
      continue;
    }

    //--------------------------------------------------------
    // MEMBERSHIP STATUS
    //--------------------------------------------------------

    const storedMembershipStatus =
      String(
        row[map["MEMBERSHIP_STATUS"]] || ""
      ).trim();

    const membershipStatus =
      KGMIS_NormalizeCardMembershipStatus_(
        storedMembershipStatus
      );

    const eligibleStatuses = [
      "ACTIVE",
      "EXTENDED",
      "LIFE TIME"
    ];

    if (
      !eligibleStatuses.includes(
        membershipStatus
      )
    ) {
      continue;
    }

    //--------------------------------------------------------
    // FAMILY ID
    //--------------------------------------------------------

    const familyId =
      String(
        row[map["FAMILY_ID"]] || ""
      )
        .trim()
        .toUpperCase();

    if (!familyId) {
      continue;
    }

    //--------------------------------------------------------
    // DUPLICATE PROTECTION
    //--------------------------------------------------------

    if (seenFamilyIds[familyId]) {

      throw new Error(
        "Duplicate membership record found for " +
        familyId +
        " in Financial Year " +
        currentFY.financialYear +
        "."
      );

    }

    seenFamilyIds[familyId] =
      true;

    //--------------------------------------------------------
    // ELIGIBLE FAMILY RECORD
    //--------------------------------------------------------

    eligibleFamilies.push({

      membershipYearKey:
        String(
          row[map["MEMBERSHIP_YEAR_KEY"]] || ""
        ).trim(),

      familyId:
        familyId,

      financialYear:
        currentFY.financialYear,

      membershipType:
        String(
          row[map["MEMBERSHIP_TYPE"]] || ""
        ).trim(),

      storedMembershipStatus:
        storedMembershipStatus,

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

  return eligibleFamilies;

}

/**
 * ============================================================
 * MEMBERSHIP RECORD COMPATIBILITY WRAPPER
 * ============================================================
 */

function KGMIS_GetMembershipRecords_() {

  return KGMIS_GetEligibleFamilies_();

}

/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestEligibleFamilies(){

  const result =
    KGMIS_GetEligibleFamilies_("2026-27");

  Logger.log(result);

  return result;

}

function KGMIS_DebugMembershipYearRows(){

  const context =
    KGMIS_Card_GetMembershipYearContext_();

  const values =
    context.sheet.getDataRange().getValues();

  const map =
    context.headerMap;

  const output=[];

  for(let r=1;r<values.length;r++){

    output.push({

      familyId: values[r][map["FAMILY_ID"]],

      financialYear: values[r][map["FINANCIAL_YEAR"]],

      membershipStatus: values[r][map["MEMBERSHIP_STATUS"]],

      paymentStatus: values[r][map["PAYMENT_STATUS"]],

      recordStatus: values[r][map["RECORD_STATUS"]]

    });

  }

  Logger.log(JSON.stringify(output,null,2));

  return output;

}

/**
 * ============================================================
 * PART 3B
 * FAMILY MEMBER LOADER
 * ============================================================
 *
 * Reads every ACTIVE member belonging to one FAMILY_ID.
 *
 * Cards are generated ONLY for eligible members.
 *
 * Uses:
 *   FAMILY_ID
 *   MEMBER_CATEGORY
 *   RECORD_STATUS
 *   RELATED_MEMBER_KEFG_ID
 *
 * from KGMIS_MASTER_DATABASE_v1.0
 * ============================================================
 */

function KGMIS_GetFamilyMembers_(familyId){

  if(!familyId){
    return [];
  }

  const context =
    KGMIS_GetMasterDatabaseContext_();

  const values =
    context.sheet
      .getDataRange()
      .getValues();

  if(values.length < 2){
    return [];
  }

  const headers = values[0];

  const map = {};

  headers.forEach(function(header,index){

    map[String(header).trim()] = index;

  });

  const members = [];

  for(let r=1;r<values.length;r++){

    if(
      String(values[r][map["FAMILY_ID"]]).trim() !==
      String(familyId).trim()
    ){
      continue;
    }

    if(
      !KGMIS_IsCardEligible_(
        values[r][map["RECORD_STATUS"]]
      )
    ){
      continue;
    }

    members.push(

      KGMIS_CreateFamilyMemberObject_(
        values[r],
        map
      )

    );

  }

  return KGMIS_SortFamilyMembers_(members);

}

/**
 * ============================================================
 * Creates one Member Object
 * ============================================================
 */

function KGMIS_CreateFamilyMemberObject_(row,map){

  return{

    kefgId:
      row[map["KEFG_ID"]],

    familyId:
      row[map["FAMILY_ID"]],

    relatedKefgId:
      row[map["RELATED_MEMBER_KEFG_ID"]],

    memberCategory:
      row[map["MEMBER_CATEGORY"]],

    recordStatus:
      row[map["RECORD_STATUS"]],

    memberName:
      row[map["MEMBER_NAME"]],

    membershipType:
      row[map["TYPE_OF_MEMBERSHIP"]],

    bloodGroup:
      row[map["BLOOD_GROUP"]],

    memberMobile:
      row[map["MEMBER_MOBILE"]],

    memberEmail:
      row[map["MEMBER_EMAIL"]],

    photoFileId:
      row[map["PHOTO"]]

  };

}

/**
 * ============================================================
 * CARD ELIGIBILITY
 * ============================================================
 */

function KGMIS_IsCardEligible_(recordStatus){

  const status =
    String(recordStatus || "")
      .trim()
      .toUpperCase();

  if(status === ""){
    return true;      // blank = active
  }

  return (
      status === "ACTIVE"
  );

}

/**
 * ============================================================
 * Sort Family Members
 * ============================================================
 */

function KGMIS_SortFamilyMembers_(members){

  const order={

    "PRIMARY MEMBER":1,

    "ALUMNI SPOUSE":2,

    "NON-ALUMNI SPOUSE":3,

    "CHILD":4

  };

  members.sort(function(a,b){

    const oa =
      order[
        String(a.memberCategory)
          .toUpperCase()
      ] || 99;

    const ob =
      order[
        String(b.memberCategory)
          .toUpperCase()
      ] || 99;

    if(oa !== ob){

      return oa-ob;

    }

    return String(a.memberName)
      .localeCompare(
        String(b.memberName)
      );

  });

  return members;

}

/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestFamilyMembers(){

  const members =
    KGMIS_GetFamilyMembers_("FAM00001");

  Logger.log(

    JSON.stringify(
      members,
      null,
      2
    )

  );

  return members;

}

/**
 * ============================================================
 * PART 4A
 * DIGITAL CARD GENERATION ENGINE
 * ============================================================
 *
 * Safe orchestration layer.
 *
 * This version:
 *
 * ✔ Reads membership records
 * ✔ Filters eligible memberships
 * ✔ Loads eligible family members
 * ✔ Counts members
 * ✔ Produces a report
 *
 * It DOES NOT create or update cards yet.
 *
 * Parts 4B, 4C and 4D will add:
 *
 * - Existing card detection
 * - New card creation
 * - Card update
 *
 * ============================================================
 */


/**
 * ============================================================
 * GENERATE CARDS FOR ONE FINANCIAL YEAR
 * ============================================================
 */

function KGMIS_GenerateCardsForFinancialYear_(
  financialYear
){

  const membershipRecords =
    KGMIS_GetMembershipRecords_(
      financialYear
    );

  const result = {

    financialYear:
      financialYear,

    familiesProcessed:
      0,

    eligibleMembers:
      0,

    skipped:
      0,

    newCards:
      0,

    updatedCards:
      0

  };

  membershipRecords.forEach(function(record){

    const familyResult =
      KGMIS_ProcessMembershipRecord_(
        record
      );

    result.familiesProcessed +=
      familyResult.familiesProcessed;

    result.eligibleMembers +=
      familyResult.eligibleMembers;

    result.skipped +=
      familyResult.skipped;

  });

  return result;

}

/**
 * ============================================================
 * PROCESS ONE MEMBERSHIP RECORD
 * ============================================================
 */

function KGMIS_ProcessMembershipRecord_(
  membershipRecord
){

  const result = {

    familiesProcessed: 0,

    eligibleMembers: 0,

    skipped: 0

  };

  const members =
    KGMIS_GetFamilyMembers_(
      membershipRecord.familyId
    );

  if(
    !members ||
    members.length === 0
  ){

    result.skipped++;

    return result;

  }

  result.familiesProcessed++;

  members.forEach(function(member){

    const memberResult =
      KGMIS_ProcessEligibleMember_(
        membershipRecord,
        member
      );

    result.eligibleMembers +=
      memberResult.eligibleMembers;

  });

  return result;

}

/**
 * ============================================================
 * PROCESS ONE ELIGIBLE MEMBER
 * ============================================================
 *
 * Part 4B will later:
 *
 * - Find existing card
 * - Create card
 * - Update card
 *
 * For now:
 * only count the member.
 *
 * ============================================================
 */

function KGMIS_ProcessEligibleMember_(
  membershipRecord,
  member
){

  return {

    eligibleMembers: 1

  };

}

function KGMIS_TestBatchGeneration(){

  const result =
    KGMIS_GenerateCardsForFinancialYear_(
      "2026-27"
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

function TEST123() {
  Logger.log("Hello");
}

/**
 * ============================================================
 * PART 4B
 * EXISTING DIGITAL CARD DETECTION
 * ============================================================
 *
 * Purpose
 * -------
 * Determines whether a Digital Membership Card already exists
 * for a member in a given Membership Year.
 *
 * Matching Keys
 * -------------
 * • KEFG_ID
 * • MEMBERSHIP_YEAR
 *
 * Returns
 * -------
 * Existing card object
 * or
 * null
 *
 * No data is modified.
 * ============================================================
 */


/**
 * ============================================================
 * FIND EXISTING CARD
 * ============================================================
 */

function KGMIS_FindExistingCard_(
  kefgId,
  membershipYear
){

  if(!kefgId || !membershipYear){
    return null;
  }

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName(
      "KEFG_MEMBER_CARDS"
    );

  if(!sheet){
    throw new Error(
      "Sheet not found : KEFG_MEMBER_CARDS"
    );
  }

  const values =
    sheet.getDataRange().getValues();

  if(values.length < 2){
    return null;
  }

  const headers =
    values[0];

  const map = {};

  headers.forEach(function(header,index){

    map[
      String(header).trim()
    ] = index;

  });

  const kefgColumn =
    map["KEFG_ID"];

  const yearColumn =
    map["MEMBERSHIP_YEAR"];

  if(
    kefgColumn === undefined ||
    yearColumn === undefined
  ){

    throw new Error(
      "Required columns not found in KEFG_MEMBER_CARDS."
    );

  }

  for(
    let r = 1;
    r < values.length;
    r++
  ){

    const row = values[r];

    if(

      String(
        row[kefgColumn]
      ).trim() !==
      String(kefgId).trim()

    ){
      continue;
    }

    if(

      String(
        row[yearColumn]
      ).trim() !==
      String(membershipYear).trim()

    ){
      continue;
    }

    const record = {};

    headers.forEach(function(header,index){

      record[
        String(header).trim()
      ] = row[index];

    });

    return record;

  }

  return null;

}

/**
 * ============================================================
 * SAFE TEST
 * Existing Card Detection
 * ============================================================
 */

function KGMIS_TestFindExistingCard(){

  const result =
    KGMIS_FindExistingCard_(

      "KEFG1007",

      "2026-27"

    );

  Logger.log(result);

  return result;

}

/**
 * ============================================================
 * PART 4C.1A
 * PERSON OBJECT STANDARD
 * ============================================================
 *
 * Every person processed by the Digital Card Generator
 * shall first be converted into this standard object.
 *
 * SOURCE
 * ------
 * "MASTER"
 *      Primary Member
 *      Spouse
 *      Children
 *
 * "DEPENDANT"
 *      Parents
 *      In-laws
 *      Future Dependants
 *
 * This allows the generator to process every person
 * identically, regardless of where the record originated.
 *
 * ============================================================
 */

function KGMIS_CreatePersonObject_(){

  return {

    source : "",              // MASTER | DEPENDANT

    familyId : "",

    kefgId : "",              // Blank for dependants

    dependantId : "",         // Blank for Master members

    memberCategory : "",

    dependantType : "",

    dependantSequence : "",

    memberName : "",

    mobile : "",

    photo : "",

    recordStatus : ""

  };

}

/**
 * ============================================================
 * CREATE PERSON OBJECT FROM MASTER MEMBER
 * ============================================================
 */

function KGMIS_CreatePersonFromMember_(member) {

  if (!member) {

    throw new Error(
      "Member object required."
    );

  }

  const person =
    KGMIS_CreatePersonObject_();

  person.source =
  KGMIS_CONFIG.SOURCE_TYPE.MEMBER;

  person.familyId =
    member.familyId || "";

  person.kefgId =
    member.kefgId || "";

  person.memberCategory =
    member.memberCategory || "";

  person.memberName =
    member.memberName || "";

  person.mobile =
    member.memberMobile || "";

  person.email =
    member.memberEmail || "";

  person.photo =
    member.photoFileId || "";

  person.recordStatus =
    member.recordStatus || "";

  return person;

}


/**
 * ============================================================
 * CREATE NEW DIGITAL CARD
 * ============================================================
 */

function KGMIS_CreateDigitalCard_(
  member,
  membershipRecord
) {

  if (!member) {

    throw new Error(
      "Member object required."
    );

  }

  if (!membershipRecord) {

    throw new Error(
      "Membership record required."
    );

  }

  const person =
    KGMIS_CreatePersonFromMember_(
      member
    );

  const cardRecord =
    KGMIS_CreateCardRecord_(
      person,
      membershipRecord
    );

  return KGMIS_SaveCardRecord_(
    cardRecord
  );

}


/**
 * ============================================================
 * UPDATE EXISTING DIGITAL CARD
 * ============================================================
 */

function KGMIS_UpdateDigitalCard_(
  existingCard,
  member,
  membershipRecord
) {

  if (!existingCard) {

    throw new Error(
      "Existing Card Record required."
    );

  }

  if (!member) {

    throw new Error(
      "Member object required."
    );

  }

  if (!membershipRecord) {

    throw new Error(
      "Membership record required."
    );

  }

  const person =
    KGMIS_CreatePersonFromMember_(
      member
    );

  const cardRecord =
    KGMIS_CreateCardRecord_(
      person,
      membershipRecord
    );

  return KGMIS_SaveCardRecord_(
    cardRecord
  );

}

/**
 * ============================================================
 * PART 4C.1B
 * MEMBER SEQUENCE
 * ============================================================
 *
 * Returns the 2-digit sequence used in CARD_ID.
 *
 * Supports both:
 *
 * MASTER members
 * DEPENDANTS
 *
 * ============================================================
 */

function KGMIS_GetMemberSequence_(person){

  if(!person){
    throw new Error(
      "Person object required."
    );
  }

  if(person.source === "DEPENDANT"){

    const seq =
      String(
        person.dependantSequence || ""
      ).trim();

    if(seq === ""){

      throw new Error(
        "Missing DEPENDANT_SEQUENCE."
      );

    }

    return Utilities.formatString(
      "%02d",
      Number(seq)
    );

  }

  switch(

    String(
      person.memberCategory || ""
    )
    .trim()
    .toUpperCase()

  ){

    case "PRIMARY MEMBER":
      return "01";

    case "NON-ALUMNI SPOUSE":
    case "NON-ALUMNI SPOUSE MEMBER":
    case "ALUMNI SPOUSE":
    case "ALUMNI SPOUSE MEMBER":
    case "SPOUSE":
  return "02";

    case "CHILD 1":
      return "03";

    case "CHILD 2":
      return "04";

    case "CHILD 3":
      return "05";

    default:

      throw new Error(

        "Unknown MEMBER_CATEGORY : " +

        person.memberCategory

      );

  }

}

/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */

function KGMIS_TestMemberSequence(){

  const master = {

    source : "MASTER",

    memberCategory :

      "PRIMARY MEMBER"

  };

  const dependant = {

    source : "DEPENDANT",

    dependantSequence : 8

  };

  Logger.log(

    KGMIS_GetMemberSequence_(master)

  );

  Logger.log(

    KGMIS_GetMemberSequence_(dependant)

  );

}

/**
 * ============================================================
 * PART 4C.2
 * CARD_ID GENERATOR
 * ============================================================
 *
 * Generates the official KEFG Digital Membership Card ID.
 *
 * Format
 * ------
 *
 * KEFG + FamilyNumber(5 digits) + MemberSequence(2 digits)
 *
 * Example
 *
 * FAM00035 + Primary Member
 *
 * becomes
 *
 * KEFG0003501
 *
 * ============================================================
 */


/**
 * ============================================================
 * CREATE CARD ID
 * ============================================================
 */

function KGMIS_CreateCardId_(person){

  if(!person){

    throw new Error(
      "Person object required."
    );

  }

  if(!person.familyId){

    throw new Error(
      "Missing FAMILY_ID."
    );

  }

  //------------------------------------------------------------
  // Remove the FAM prefix
  //------------------------------------------------------------

  const familyNumber =

    String(person.familyId)

      .replace(/^FAM/i,"")

      .trim();

  //------------------------------------------------------------
  // Validate
  //------------------------------------------------------------

  if(

    familyNumber.length !== 5

  ){

    throw new Error(

      "Invalid FAMILY_ID : " +

      person.familyId

    );

  }

  //------------------------------------------------------------
  // Get member sequence
  //------------------------------------------------------------

  const memberSequence =

    KGMIS_GetMemberSequence_(

      person

    );

  //------------------------------------------------------------
  // Build CARD_ID
  //------------------------------------------------------------

  return (

    "KEFG" +

    familyNumber +

    memberSequence

  );

}

/**
 * ============================================================
 * SAFE TEST
 * CARD_ID GENERATOR
 * ============================================================
 */

function KGMIS_TestCreateCardId(){

  const master = {

    source : "MASTER",

    familyId : "FAM00035",

    memberCategory :

      "PRIMARY MEMBER"

  };

  const dependant = {

    source : "DEPENDANT",

    familyId : "FAM00035",

    dependantSequence : 8

  };

  Logger.log(

    KGMIS_CreateCardId_(master)

  );

  Logger.log(

    KGMIS_CreateCardId_(dependant)

  );

}

/**
 * ============================================================
 * PART 4C.3
 * QR TOKEN GENERATOR
 * ============================================================
 *
 * Generates a globally unique QR Token.
 *
 * This token is NOT the CARD_ID.
 *
 * It will later be used for:
 *
 * • QR Code
 * • Card Verification
 * • Mobile App
 * • Future API
 *
 * Format
 *
 * KGMIS-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * ============================================================
 */


/**
 * ============================================================
 * CREATE QR TOKEN
 * ============================================================
 */

function KGMIS_CreateQrToken_(){

  const uuid =

    Utilities.getUuid()

      .replace(/-/g,"")

      .toUpperCase();

  return "KGMIS-" + uuid;

}

/**
 * ============================================================
 * SAFE TEST
 * QR TOKEN
 * ============================================================
 */

function KGMIS_TestCreateQrToken(){

  Logger.log(

    KGMIS_CreateQrToken_()

  );

  Logger.log(

    KGMIS_CreateQrToken_()

  );

}

function KGMIS_TestGenerateMembershipCards() {

  const result =
    KGMIS_GenerateMembershipCards(
      "2026-27"
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
