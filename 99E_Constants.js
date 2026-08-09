/**
 * KMIS Platform v2.0
 * System Constants
 *
 * This file contains values that should remain consistent
 * throughout the KMIS platform.
 *
 * Do not place environment-specific values here.
 * Environment-specific settings belong in:
 * - 00_Config.gs
 * - KMIS_SYSTEM_SETTINGS
 */

const KMIS_CONSTANTS = Object.freeze({

  APPLICATION: Object.freeze({
    NAME: 'KEFG Membership Information System',
    SHORT_NAME: 'KMIS',
    PLATFORM_VERSION: '2.0'
  }),


  ENVIRONMENTS: Object.freeze({
    DEVELOPMENT: 'DEVELOPMENT',
    TESTING: 'TESTING',
    PRODUCTION: 'PRODUCTION'
  }),


  SHEETS: Object.freeze({
    ACCESS_CONTROL: 'KGMIS_ACCESS_CONTROL',
    SYSTEM_SETTINGS: 'KMIS_SYSTEM_SETTINGS',
    CHANGE_LOG: 'KMIS_CHANGE_LOG'
  }),


  USER_ROLES: Object.freeze({
    DIRECTORY_USER: 'DIRECTORY_USER',
    VIEWER: 'VIEWER',
    TREASURER: 'TREASURER',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN'
  }),


  USER_STATUS: Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE'
  }),


  SUBSCRIPTION_STATUS: Object.freeze({
    PAID: 'PAID',
    NOT_PAID: 'NOT PAID',
    PENDING: 'PENDING',
    EXEMPTED: 'EXEMPTED'
  }),


  RECORD_STATUS: Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    DECEASED: 'DECEASED',
    ARCHIVED: 'ARCHIVED'
  }),


  MEMBER_CATEGORY: Object.freeze({
    PRIMARY_MEMBER: 'PRIMARY MEMBER',
    NON_ALUMNI_SPOUSE: 'NON-ALUMNI SPOUSE',
    ALUMNI_SPOUSE: 'ALUMNI SPOUSE',
    INDIVIDUAL_MEMBER: 'INDIVIDUAL MEMBER'
  }),


  BOOLEAN_VALUES: Object.freeze({
    YES: 'YES',
    NO: 'NO'
  }),


  DATA_CONSENT: Object.freeze({
    GIVEN: 'YES',
    NOT_GIVEN: 'NO',
    PENDING: 'PENDING'
  }),


  VOLUNTEER_STATUS: Object.freeze({
    YES: 'YES',
    NO: 'NO',
    MAYBE: 'MAYBE',
    CONTACT_ME: 'PLEASE CONTACT ME'
  }),


  PREFERRED_FAMILY_CONTACT: Object.freeze({
    PRIMARY_MEMBER: 'PRIMARY MEMBER',
    SPOUSE: 'SPOUSE',
    EITHER: 'EITHER',
    BOTH: 'BOTH'
  }),


  DATE_FORMATS: Object.freeze({
    SHEET_DATE: 'dd-MMM-yyyy',
    SHEET_DATETIME: 'dd-MMM-yyyy HH:mm',
    HTML_DATE: 'yyyy-MM-dd',
    TIMESTAMP: 'yyyy-MM-dd HH:mm:ss'
  }),


  IMPORT_RULES: Object.freeze({
    UPDATE_IF_CHANGED: 'UPDATE_IF_CHANGED',
    UPDATE_ONLY_IF_NEW_VALUE: 'UPDATE_ONLY_IF_NEW_VALUE',
    UPDATE_ONLY_IF_NEW_UPLOAD: 'UPDATE_ONLY_IF_NEW_UPLOAD',
    MATCH_ONLY: 'MATCH_ONLY',
    GENERATE: 'GENERATE',
    IGNORE: 'IGNORE',
    AUTO_TIMESTAMP: 'AUTO_TIMESTAMP'
  }),


  FIELD_CONTROL_TYPES: Object.freeze({
    EDITABLE: 'EDITABLE',
    DISPLAY_ONLY: 'DISPLAY_ONLY',
    DERIVED: 'DERIVED',
    INTERNAL: 'INTERNAL'
  }),


  ACCESS_PERMISSIONS: Object.freeze({
    DIRECTORY_VIEW: 'DIRECTORY_VIEW',
    TREASURER_VIEW: 'TREASURER_VIEW',
    SUBSCRIPTION_UPDATE: 'SUBSCRIPTION_UPDATE',
    FAMILY_PROFILE_REVIEW: 'FAMILY_PROFILE_REVIEW',
    DATABASE_ADMIN: 'DATABASE_ADMIN',
    APPLICATION_ADMIN: 'APPLICATION_ADMIN',
    ACCESS_MANAGEMENT: 'ACCESS_MANAGEMENT'
  }),


  STANDARD_MESSAGES: Object.freeze({
    ACCESS_DENIED:
      'Access denied. You are not authorised to perform this action.',

    INVALID_USER:
      'The signed-in Google account is not registered in KMIS.',

    DATABASE_NOT_FOUND:
      'The KMIS master database sheet could not be located.',

    INVALID_SCHEMA:
      'The KMIS master database schema does not match the required structure.',

    RECORD_NOT_FOUND:
      'The requested KMIS record could not be found.',

    UPDATE_SUCCESS:
      'The KMIS record was updated successfully.',

    SAVE_SUCCESS:
      'The information was saved successfully.'
  }),


  SYSTEM_LIMITS: Object.freeze({
    MAX_SEARCH_RESULTS: 100,
    MAX_REPORT_ROWS: 5000,
    LOCK_TIMEOUT_MILLISECONDS: 30000
  })

});


/**
 * Returns all KMIS constants.
 *
 * Intended mainly for testing and administrator tools.
 */
function KMIS_CONST_GetAll() {
  return KMIS_CONSTANTS;
}


/**
 * Returns the valid KMIS user roles.
 */
function KMIS_CONST_GetUserRoles() {
  return Object.values(
    KMIS_CONSTANTS.USER_ROLES
  );
}


/**
 * Returns valid subscription statuses.
 */
function KMIS_CONST_GetSubscriptionStatuses() {
  return Object.values(
    KMIS_CONSTANTS.SUBSCRIPTION_STATUS
  );
}


/**
 * Returns valid user statuses.
 */
function KMIS_CONST_GetUserStatuses() {
  return Object.values(
    KMIS_CONSTANTS.USER_STATUS
  );
}


/**
 * Manual test.
 */
function KMIS_TestConstants() {
  const result = {
    application:
      KMIS_CONSTANTS.APPLICATION,

    roles:
      KMIS_CONST_GetUserRoles(),

    subscriptionStatuses:
      KMIS_CONST_GetSubscriptionStatuses(),

    userStatuses:
      KMIS_CONST_GetUserStatuses(),

    dateFormats:
      KMIS_CONSTANTS.DATE_FORMATS
  };

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}