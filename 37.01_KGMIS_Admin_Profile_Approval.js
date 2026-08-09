/**
 * ============================================================
 * Returns the complete Admin Review Queue.
 *
 * Combines:
 * 1. Family Profile Update Requests
 * 2. Family Member Update Requests
 *
 * Status:
 * PENDING only.
 * ============================================================
 */
function KGMIS_Admin_GetReviewQueue() {

  KGMIS_RequireDatabaseAdminAccess_();

  const profileRequests =
    KGMIS_Admin_GetPendingProfileRequests_();

  const familyMemberRequests =
    KGMIS_Admin_GetPendingFamilyMemberRequests_();

  const queue = profileRequests.map(function (profileRequest) {

  const matchingFamilyMembers =
  familyMemberRequests.filter(function (familyRequest) {

    return (
      String(familyRequest.SUBMISSION_ID || '').trim() ===
        String(profileRequest.SUBMISSION_ID || '').trim() &&
      String(familyRequest.REQUEST_STATUS || '')
        .trim()
        .toUpperCase() === 'PENDING'
    );

  });

    return {

      requestId:
        profileRequest.REQUEST_ID,

      submissionId:
        profileRequest.SUBMISSION_ID,

      familyId:
        profileRequest.FAMILY_ID,

      primaryMemberKefgId:
        profileRequest.PRIMARY_MEMBER_KEFG_ID,

      submittedOn:
        profileRequest.SUBMITTED_ON,

      submittedBy:
        profileRequest.SUBMITTED_BY_EMAIL,

      changedSections:
        profileRequest.CHANGED_SECTIONS,

      profileStatus:
        profileRequest.REQUEST_STATUS,

      familyMemberCount:
        matchingFamilyMembers.length,

      profileRequest:
        profileRequest,

      familyMemberRequests:
        matchingFamilyMembers

    };

  });

  return {
    success: true,
    queue: queue
  };

}

/**
 * ============================================================
 * Returns all pending Family Profile Update Requests.
 * ============================================================
 */
function KGMIS_Admin_GetPendingProfileRequests_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName('KGMIS_FAMILY_PROFILE_UPDATE_REQUESTS');

  if (!sheet) {
    throw new Error('Sheet not found: KGMIS_FAMILY_PROFILE_UPDATE_REQUESTS');
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0];

  const requests = [];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const record = {};

    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    if (String(record.REQUEST_STATUS).toUpperCase() !== 'PENDING') {
      continue;
    }

    requests.push(record);

  }

  return requests;

}

/**
 * ============================================================
 * Returns all pending Family Member Update Requests.
 * ============================================================
 */
function KGMIS_Admin_GetPendingFamilyMemberRequests_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName('KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS');

  if (!sheet) {
    throw new Error('Sheet not found: KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS');
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return [];
  }

  const headers = values[0];

  const requests = [];

  for (let i = 1; i < values.length; i++) {

    const row = values[i];

    const record = {};

    headers.forEach(function(header, index) {
      record[header] = row[index];
    });

    if (String(record.REQUEST_STATUS).toUpperCase() !== 'PENDING') {
      continue;
    }

    requests.push(record);

  }

  return requests;

}

/**
 * ============================================================
 * Returns a complete review package for one Request ID.
 * ============================================================
 */
function KGMIS_Admin_GetReviewRequest(requestId) {

  const queue = KGMIS_Admin_GetReviewQueue().queue;

  const request = queue.find(function(item) {
    return String(item.requestId) === String(requestId);
  });

  if (!request) {
    throw new Error("Review request not found: " + requestId);
  }

  return {
    success: true,
    request: request,
    profile: request.profileRequest,
    familyMembers: request.familyMemberRequests
  };

}

/**
 * ============================================================
 * TEST Returns a complete review package for one Request ID.
 * ============================================================
 */

function testReviewRequest() {
  const result = KGMIS_Admin_GetReviewRequest(
    "FPR-20260729-010833-16D43D2F"
  );

  Logger.log(JSON.stringify(result, null, 2));
}


