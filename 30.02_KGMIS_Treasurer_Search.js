/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Module — Search and Portal Configuration
 *
 * File:
 * 30.02_KGMIS_Treasurer_Search.gs
 * ============================================================
 *
 * Contains:
 * - Shared Treasurer data configuration
 * - Portal configuration
 * - Family search
 * - Compatibility wrappers for the existing HTML
 */


/**
 * ============================================================
 * Shared Treasurer Data Configuration
 * ============================================================
 */

const KGMIS_TREASURER_DATA_CONFIG = Object.freeze({

  HEADERS: Object.freeze({

    FAMILY_ID: 'FAMILY_ID',
    ZONE: 'ZONE',

    MEMBER_CATEGORY: 'MEMBER_CATEGORY',
    RECORD_STATUS: 'RECORD_STATUS',

    MEMBER_NAME: 'MEMBER_NAME',
    MEMBER_MOBILE: 'MEMBER_MOBILE',
    ALUMNI_ASSOCIATION: 'ALUMNI_ASSOCIATION',
    BRANCH: 'BRANCH',
    YEAR_BATCH: 'YEAR_BATCH',

    SPOUSE_NAME: 'SPOUSE_NAME',
    SPOUSE_MOBILE: 'SPOUSE_MOBILE',

    SPOUSE_ALUMNI_ASSOCIATION:
      'SPOUSE_ALUMNI_ASSOCIATION',

    SPOUSE_BRANCH: 'SPOUSE_BRANCH',
    SPOUSE_BATCH_YEAR: 'SPOUSE_BATCH_YEAR',

    SUBSCRIPTION_STATUS:
      'SUBSCRIPTION_STATUS_2026_2027',

    PAYMENT_DATE:
      'SUBSCRIPTION_PAYMENT_DATE_2026_2027'

  }),

  STATUS_OPTIONS: Object.freeze([
    'PAID',
    'NOT PAID',
    'PENDING',
    'EXEMPTED'
  ]),

  MAX_SEARCH_RESULTS: 50,

  DATE_DISPLAY_FORMAT: 'dd-MMM-yyyy'

});


/**
 * ============================================================
 * Portal Configuration
 * ============================================================
 *
 * Returns:
 * - Current authorised user
 * - User permissions
 * - Subscription status options
 * - Available zones
 */

function KGMIS_Treasurer_GetPortalConfiguration() {

  const user =
    KGMIS_RequireModuleAccess_(

      KGMIS_TREASURER_CONFIG.MODULE_NAME,

      KGMIS_TREASURER_CONFIG.VIEW_ACTION

    );

  const context =
    KGMIS_Treasurer_GetContext_();

  return {

    systemName:
      KGMIS_TREASURER_CONFIG.SYSTEM_NAME,

    portalTitle:
      KGMIS_TREASURER_CONFIG.MODULE_TITLE,

    currentUser: {

      email: user.email,

      userName: user.userName,

      role: user.role

    },

    permissions: {

      canView: true,

      canUpdateSubscription:
        KGMIS_UserCanAccessModule_(

          user.role,

          KGMIS_TREASURER_CONFIG.MODULE_NAME,

          KGMIS_TREASURER_CONFIG.UPDATE_ACTION

        )

    },

    statusOptions: [
      ...KGMIS_TREASURER_DATA_CONFIG.STATUS_OPTIONS
    ],

    zones:
      KGMIS_Treasurer_GetUniqueZones_(
        context
      )

  };

}


/**
 * ============================================================
 * Family Search
 * ============================================================
 *
 * Searches by:
 * - Family ID
 * - Zone
 * - Member name
 * - Spouse name
 * - Mobile number
 * - Alumni association
 * - Branch
 * - Batch/year
 * - Subscription status
 * - Payment date
 */

function KGMIS_Treasurer_SearchFamilies(
  searchText
) {

  KGMIS_RequireModuleAccess_(

    KGMIS_TREASURER_CONFIG.MODULE_NAME,

    KGMIS_TREASURER_CONFIG.VIEW_ACTION

  );

  const query =
    KGMIS_Treasurer_NormalizeSearchValue_(
      searchText
    );

  if (!query) {

    throw new Error(

      'Enter a Family ID, Zone, name, mobile number ' +
      'or alumni detail.'

    );

  }

  const context =
    KGMIS_Treasurer_GetContext_();

  const familyMap =
    KGMIS_Treasurer_BuildFamilyMap_(
      context
    );

  const results = [];

  familyMap.forEach(family => {

    const searchableValues = [

      family.familyId,
      family.zone,

      family.memberName,
      family.memberMobile,
      family.memberAlumniAssociation,
      family.memberBranch,
      family.memberBatchYear,

      family.spouseName,
      family.spouseMobile,
      family.spouseAlumniAssociation,
      family.spouseBranch,
      family.spouseBatchYear,

      family.subscriptionStatus,
      family.paymentDateDisplay

    ].map(
      KGMIS_Treasurer_NormalizeSearchValue_
    );

    const matched =
      searchableValues.some(
        value => value.includes(query)
      );

    if (matched) {
      results.push(family);
    }

  });

  return results

    .sort(
      KGMIS_Treasurer_CompareFamilies_
    )

    .slice(
      0,
      KGMIS_TREASURER_DATA_CONFIG
        .MAX_SEARCH_RESULTS
    );

}


/**
 * ============================================================
 * Compatibility Wrappers
 * ============================================================
 *
 * The existing Index.html probably calls:
 *
 * getPortalConfiguration()
 * searchFamilies()
 *
 * These wrappers preserve compatibility so that the HTML
 * does not need to be changed immediately.
 */


/**
 * Existing HTML compatibility wrapper.
 */
function getPortalConfiguration() {

  return KGMIS_Treasurer_GetPortalConfiguration();

}


/**
 * Existing HTML compatibility wrapper.
 */
function searchFamilies(searchText) {

  return KGMIS_Treasurer_SearchFamilies(
    searchText
  );

}