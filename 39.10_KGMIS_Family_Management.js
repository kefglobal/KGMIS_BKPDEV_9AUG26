/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Module        : Family Management
 * File Name     : 39.10_KGMIS_Family_Management.gs
 * Version       : Enterprise Edition 1.0
 * Status        : Development
 * Designed & Developed by: James Joseph Alenchery
 * ============================================================
 *
 * DESCRIPTION
 * -----------
 * This file contains the backend workflow functions for the
 * Family Management module in the Administration Portal.
 *
 * Current development phase:
 *
 * 1. Search families using the fast Search Service.
 * 2. Load one complete family using the Family Profile
 *    Business Service.
 *
 * This version performs READ operations only.
 *
 * No database update, insert or delete operation is included.
 * ============================================================
 */


/**
 * Searches families for the Family Management portal.
 *
 * The actual search is performed by:
 *
 * KGMIS_SEARCH_FamilyManagementFamilies()
 *
 * @param {string} searchText
 * @param {string} searchType
 * @return {Object}
 */
function KGMIS_FamilyManagement_SearchFamilies(
  searchText,
  searchType
) {

  /*
   * This module belongs to the Administration Portal.
   */
  KGMIS_RequireDatabaseAdminAccess_();

  const safeSearchText =
    String(
      searchText === null ||
      searchText === undefined
        ? ''
        : searchText
    ).trim();

  const safeSearchType =
    String(
      searchType || 'ALL'
    )
      .trim()
      .toUpperCase();

  if (!safeSearchText) {
    throw new Error(
      'Enter a search value.'
    );
  }

  if (safeSearchText.length < 2) {
    throw new Error(
      'Enter at least two characters to search.'
    );
  }

  const results =
    KGMIS_SEARCH_FamilyManagementFamilies(
      safeSearchText,
      {
        searchType:
          safeSearchType,

        maxResults:
          20
      }
    );

  return {
    success: true,

    searchText:
      safeSearchText,

    searchType:
      safeSearchType,

    resultCount:
      Array.isArray(results)
        ? results.length
        : 0,

    results:
      Array.isArray(results)
        ? results
        : [],

    message:
      Array.isArray(results) &&
      results.length
        ? (
            results.length +
            (
              results.length === 1
                ? ' family found.'
                : ' families found.'
            )
          )
        : 'No matching families were found.'
  };

}


/**
 * Loads one complete family for the Family Management portal.
 *
 * The complete family object is built by:
 *
 * KMIS_FP_GetFamilyProfile()
 *
 * The returned object includes:
 *
 * - Internal IDs
 * - Family overview
 * - Primary Member
 * - Spouse
 * - Family-level information
 * - Family Members
 * - Communication information
 * - Subscription information
 *
 * @param {string} familyId
 * @return {Object}
 */
function KGMIS_FamilyManagement_GetFamily(
  familyId
) {

  KGMIS_RequireDatabaseAdminAccess_();

  const safeFamilyId =
    String(
      familyId === null ||
      familyId === undefined
        ? ''
        : familyId
    )
      .trim()
      .toUpperCase();

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  if (
    !/^FAM\d{5}$/.test(
      safeFamilyId
    )
  ) {
    throw new Error(
      'Enter a valid FAMILY_ID in the format FAM00001.'
    );
  }

  /*
   * Admin access was already verified above.
   *
   * Passing true prevents the Family Profile service
   * from performing the same access check a second time.
   */
  const result =
    KMIS_FP_GetFamilyProfile(
      safeFamilyId,
      true
    );

  if (
    !result ||
    result.success !== true ||
    !result.data
  ) {
    return {
      success: false,

      familyId:
        safeFamilyId,

      family:
        null,

      message:
        result && result.message
          ? result.message
          : (
              'The selected family could not be loaded.'
            )
    };
  }

  return {
    success: true,

    familyId:
      safeFamilyId,

    family:
      result.data,

    message:
      'The selected family was loaded successfully.'
  };

}


/**
 * Safe manual test for Family Management search.
 *
 * This performs READ operations only.
 */
function KGMIS_FamilyManagement_TestSearch() {

  const result =
    KGMIS_FamilyManagement_SearchFamilies(
      'FAM00035',
      'FAMILY_ID'
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
 * Safe manual test for loading one complete family.
 *
 * This performs READ operations only.
 */
function KGMIS_FamilyManagement_TestGetFamily() {

  const result =
    KGMIS_FamilyManagement_GetFamily(
      'FAM00035'
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