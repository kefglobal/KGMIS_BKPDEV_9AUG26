/**
 * ========================================================
 * KGMIS Hero Dashboard Service
 * ========================================================
 *
 * Reads:
 *   KEFG_ANNOUNCEMENTS
 *
 * Returns:
 *   - Highest-priority active announcement
 *   - Nearest upcoming active event
 *   - Placeholder statistics for the next implementation phase
 */

const KGMIS_HERO_ANNOUNCEMENT_SHEET =
  'KEFG_ANNOUNCEMENTS';

const KGMIS_HERO_MASTER_SHEET =
  'KGMIS_MASTER_DATABASE_v1.0';

const KGMIS_HERO_CARD_SHEET =
  'KEFG_MEMBER_CARDS';

const KGMIS_HERO_MEMBERSHIP_YEAR_SHEET =
  'KGMIS_MEMBERSHIP_YEAR';

const KGMIS_HERO_CURRENT_FINANCIAL_YEAR =
  '2026-27';

function getHeroDashboard(sessionToken) {
  try {
    if (!sessionToken) {
      throw new Error('Session token is required.');
    }

    /*
     * This is the public session-checking function already used
     * by the KGMIS OTP authentication service.
     * It throws an error when the token is invalid or expired.
     */
    const auth =
      KGMIS_OTP_GetSessionUser(
        sessionToken
      );

    if (
      !auth ||
      auth.success !== true ||
      !auth.user
    ) {
      throw new Error(
        'Your session has expired.'
      );
    }

    const cache =
      CacheService.getScriptCache();

    const cached =
      cache.get('KGMIS_HERO_DASHBOARD_V5');

    if (cached) {
      const cachedData =
        JSON.parse(cached);

      cachedData.success = true;
      return cachedData;
    }

    const announcementData =
      KGMIS_readHeroAnnouncements_();

    const statistics =
      KGMIS_readHeroStatistics_();

    const response = {
      success: true,
      announcement:
        announcementData.announcement,
      nextEvent:
        announcementData.nextEvent,
      statistics:
        statistics
    };

    cache.put(
      'KGMIS_HERO_DASHBOARD_V5',
      JSON.stringify(response),
      300
    );

    return response;

  } catch (error) {
    console.error('getHeroDashboard failed:', error);

    return {
      success: false,
      message: error && error.message
        ? error.message
        : 'Unable to load dashboard data.',
      announcement: null,
      nextEvent: null,
      statistics: {
        families: null,
        members: null,
        paidFamilies: null,
        digitalCards: null
      }
    };
  }
}

function KGMIS_readHeroAnnouncements_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(
    KGMIS_HERO_ANNOUNCEMENT_SHEET
  );

  if (!sheet) {
    throw new Error(
      'Sheet not found: ' + KGMIS_HERO_ANNOUNCEMENT_SHEET
    );
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return {
      announcement: null,
      nextEvent: null
    };
  }

  const headers = values[0].map(function (header) {
    return String(header || '').trim().toUpperCase();
  });

  const columnIndex = KGMIS_buildHeaderIndex_(headers);
  KGMIS_validateHeroHeaders_(columnIndex);

  const now = new Date();
  const activeAnnouncements = [];
  const upcomingEvents = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    const row = values[rowIndex];

    if (KGMIS_isEmptyHeroRow_(row)) {
      continue;
    }

    const status = KGMIS_getSheetValue_(
      row,
      columnIndex,
      'STATUS'
    ).toUpperCase();

    if (status !== 'ACTIVE') {
      continue;
    }

    const showOnMainPortal = KGMIS_isTruthy_(
      KGMIS_getRawSheetValue_(
        row,
        columnIndex,
        'SHOW_ON_MAIN_PORTAL'
      )
    );

    if (!showOnMainPortal) {
      continue;
    }

    const displayFrom = KGMIS_toDate_(
      KGMIS_getRawSheetValue_(
        row,
        columnIndex,
        'DISPLAY_FROM'
      )
    );

    const displayUntil = KGMIS_toDate_(
      KGMIS_getRawSheetValue_(
        row,
        columnIndex,
        'DISPLAY_UNTIL'
      )
    );

    if (displayFrom && now.getTime() < displayFrom.getTime()) {
      continue;
    }

    if (displayUntil && now.getTime() > displayUntil.getTime()) {
      continue;
    }

    const category = KGMIS_getSheetValue_(
      row,
      columnIndex,
      'CATEGORY'
    );

    const eventDate = KGMIS_toDate_(
      KGMIS_getRawSheetValue_(
        row,
        columnIndex,
        'EVENT_DATE_TIME'
      )
    );

    const eventLocation = KGMIS_getSheetValue_(
      row,
      columnIndex,
      'EVENT_LOCATION'
    );

    const shortDescription = KGMIS_getSheetValue_(
      row,
      columnIndex,
      'SHORT_DESCRIPTION'
    );

    const item = {
      id: KGMIS_getSheetValue_(
        row,
        columnIndex,
        'ANNOUNCEMENT_ID'
      ),
      title: KGMIS_getSheetValue_(
        row,
        columnIndex,
        'TITLE'
      ),
      shortDescription: shortDescription,
      description: KGMIS_getSheetValue_(
        row,
        columnIndex,
        'FULL_DESCRIPTION'
      ),
      category: category || 'KEF Global Update',
      eventLocation: eventLocation,
      priority: KGMIS_normalisePriority_(
        KGMIS_getSheetValue_(
          row,
          columnIndex,
          'PRIORITY'
        )
      ),
      displayOrder: KGMIS_normaliseDisplayOrder_(
        KGMIS_getRawSheetValue_(
          row,
          columnIndex,
          'DISPLAY_ORDER'
        )
      ),
      displayFrom: displayFrom
        ? displayFrom.toISOString()
        : '',
      displayUntil: displayUntil
        ? displayUntil.toISOString()
        : '',
      buttonText: KGMIS_getSheetValue_(
        row,
        columnIndex,
        'ACTION_BUTTON_TEXT'
      ),
      actionUrl: KGMIS_getSheetValue_(
        row,
        columnIndex,
        'ACTION_URL'
      ),
      imageUrl: KGMIS_getSheetValue_(
        row,
        columnIndex,
        'IMAGE_URL'
      ),
      imageFileId: KGMIS_getSheetValue_(
        row,
        columnIndex,
        'IMAGE_FILE_ID'
      ),
      posterUrl: KGMIS_getHeroPosterUrl_(
        row,
        columnIndex
      )
    };

    if (!item.title) {
      continue;
    }

    if (KGMIS_isEventCategory_(category)) {
      // EVENT_DATE_TIME is the actual event time.
      // DISPLAY_FROM only controls when the notice becomes visible.
      if (!eventDate || eventDate.getTime() < now.getTime()) {
        continue;
      }

      item.eventDate = eventDate.toISOString();
      item.shortDescription = KGMIS_buildEventSummary_(
        shortDescription,
        eventLocation
      );

      upcomingEvents.push(item);
      continue;
    }

    activeAnnouncements.push(item);
  }

  activeAnnouncements.sort(KGMIS_sortAnnouncements_);
  upcomingEvents.sort(KGMIS_sortEvents_);

  return {
    announcement: activeAnnouncements.length
      ? activeAnnouncements[0]
      : null,
    nextEvent: upcomingEvents.length
      ? upcomingEvents[0]
      : null
  };
}


/**
 * Reads live counts for the compact dashboard.
 *
 * @return {Object}
 */
function KGMIS_readHeroStatistics_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const masterSheet =
    spreadsheet.getSheetByName(
      KGMIS_HERO_MASTER_SHEET
    );

  if (!masterSheet) {
    throw new Error(
      'Sheet not found: ' +
      KGMIS_HERO_MASTER_SHEET
    );
  }

  const masterValues =
    masterSheet.getDataRange().getValues();

  let families = 0;
  let members = 0;
  let paidFamilies = 0;

  if (masterValues.length > 1) {
    const masterHeaders =
      masterValues[0].map(function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      });

    const masterIndex =
      KGMIS_buildHeaderIndex_(
        masterHeaders
      );

    const familyIds = {};

    for (
      let rowIndex = 1;
      rowIndex < masterValues.length;
      rowIndex += 1
    ) {
      const row =
        masterValues[rowIndex];

      if (KGMIS_isEmptyHeroRow_(row)) {
        continue;
      }

      const recordStatus =
        KGMIS_getSheetValue_(
          row,
          masterIndex,
          'RECORD_STATUS'
        ).toUpperCase();

      if (
        [
          'INACTIVE',
          'ARCHIVED',
          'DELETED'
        ].includes(recordStatus)
      ) {
        continue;
      }

      const memberId =
        KGMIS_getSheetValue_(
          row,
          masterIndex,
          'KEFG_ID'
        );

      if (memberId) {
        members += 1;
      }

      const familyId =
        KGMIS_getSheetValue_(
          row,
          masterIndex,
          'FAMILY_ID'
        );

      if (familyId) {
        familyIds[familyId] = true;
      }
    }

    families =
      Object.keys(familyIds).length;
  }

  paidFamilies =
    KGMIS_countPaidFamiliesFromMembershipYear_(
      spreadsheet
    );

  let digitalCards = 0;

  const cardSheet =
    spreadsheet.getSheetByName(
      KGMIS_HERO_CARD_SHEET
    );

  if (cardSheet) {
    const cardValues =
      cardSheet.getDataRange().getValues();

    if (cardValues.length > 1) {
      const cardHeaders =
        cardValues[0].map(function (header) {
          return String(header || '')
            .trim()
            .toUpperCase();
        });

      const cardIndex =
        KGMIS_buildHeaderIndex_(
          cardHeaders
        );

      for (
        let rowIndex = 1;
        rowIndex < cardValues.length;
        rowIndex += 1
      ) {
        const row =
          cardValues[rowIndex];

        if (KGMIS_isEmptyHeroRow_(row)) {
          continue;
        }

        const cardId =
          KGMIS_getSheetValue_(
            row,
            cardIndex,
            'CARD_ID'
          );

        const cardStatus =
          KGMIS_getSheetValue_(
            row,
            cardIndex,
            'CARD_STATUS'
          ).toUpperCase();

        if (
          cardId &&
          [
            'ACTIVE',
            'ISSUED'
          ].includes(cardStatus)
        ) {
          digitalCards += 1;
        }
      }
    }
  }

  return {
    families: families,
    members: members,
    paidFamilies: paidFamilies,
    digitalCards: digitalCards
  };
}



/**
 * Counts unique paid families from KGMIS_MEMBERSHIP_YEAR.
 *
 * PAYMENT_STATUS is the authoritative field for payment.
 * Only the configured financial year and active records count.
 *
 * @param {Spreadsheet} spreadsheet
 * @return {number}
 */
function KGMIS_countPaidFamiliesFromMembershipYear_(
  spreadsheet
) {
  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_HERO_MEMBERSHIP_YEAR_SHEET
    );

  if (!sheet) {
    throw new Error(
      'Sheet not found: ' +
      KGMIS_HERO_MEMBERSHIP_YEAR_SHEET
    );
  }

  const values =
    sheet.getDataRange().getValues();

  if (values.length < 2) {
    return 0;
  }

  const headers =
    values[0].map(function (header) {
      return String(header || '')
        .trim()
        .toUpperCase();
    });

  const index =
    KGMIS_buildHeaderIndex_(headers);

  const requiredHeaders = [
    'FAMILY_ID',
    'FINANCIAL_YEAR',
    'PAYMENT_STATUS',
    'RECORD_STATUS'
  ];

  const missingHeaders =
    requiredHeaders.filter(function (header) {
      return index[header] === undefined;
    });

  if (missingHeaders.length) {
    throw new Error(
      'Missing KGMIS_MEMBERSHIP_YEAR header(s): ' +
      missingHeaders.join(', ')
    );
  }

  const paidFamilyIds = {};

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex += 1
  ) {
    const row =
      values[rowIndex];

    if (KGMIS_isEmptyHeroRow_(row)) {
      continue;
    }

    const recordStatus =
      KGMIS_getSheetValue_(
        row,
        index,
        'RECORD_STATUS'
      ).toUpperCase();

    if (
      [
        'INACTIVE',
        'ARCHIVED',
        'DELETED'
      ].includes(recordStatus)
    ) {
      continue;
    }

    const financialYear =
      KGMIS_getSheetValue_(
        row,
        index,
        'FINANCIAL_YEAR'
      ).toUpperCase();

    if (
      financialYear !==
      KGMIS_HERO_CURRENT_FINANCIAL_YEAR.toUpperCase()
    ) {
      continue;
    }

    const paymentStatus =
      KGMIS_getSheetValue_(
        row,
        index,
        'PAYMENT_STATUS'
      ).toUpperCase();

    if (
      ![
        'PAID',
        'FULLY PAID',
        'COMPLETED'
      ].includes(paymentStatus)
    ) {
      continue;
    }

    const familyId =
      KGMIS_getSheetValue_(
        row,
        index,
        'FAMILY_ID'
      );

    if (familyId) {
      paidFamilyIds[familyId] = true;
    }
  }

  return Object.keys(
    paidFamilyIds
  ).length;
}



/**
 * Returns a browser-displayable poster URL without embedding
 * the image bytes in the dashboard response.
 *
 * IMAGE_FILE_ID is preferred. IMAGE_URL is used as fallback.
 *
 * @param {Array} row
 * @param {Object} columnIndex
 * @return {string}
 */
function KGMIS_getHeroPosterUrl_(
  row,
  columnIndex
) {
  const imageFileId =
    KGMIS_getSheetValue_(
      row,
      columnIndex,
      'IMAGE_FILE_ID'
    );

  if (imageFileId) {
    return (
      'https://lh3.googleusercontent.com/d/' +
      encodeURIComponent(imageFileId) +
      '=w1200'
    );
  }

  const imageUrl =
    KGMIS_getSheetValue_(
      row,
      columnIndex,
      'IMAGE_URL'
    );

  return imageUrl;
}

function KGMIS_validateHeroHeaders_(columnIndex) {
  const requiredHeaders = [
    'ANNOUNCEMENT_ID',
    'TITLE',
    'SHORT_DESCRIPTION',
    'FULL_DESCRIPTION',
    'CATEGORY',
    'EVENT_DATE_TIME',
    'EVENT_LOCATION',
    'PRIORITY',
    'DISPLAY_FROM',
    'DISPLAY_UNTIL',
    'DISPLAY_ORDER',
    'SHOW_ON_MAIN_PORTAL',
    'ACTION_BUTTON_TEXT',
    'ACTION_URL',
    'IMAGE_FILE_ID',
    'IMAGE_URL',
    'STATUS'
  ];

  const missingHeaders = requiredHeaders.filter(function (header) {
    return columnIndex[header] === undefined;
  });

  if (missingHeaders.length) {
    throw new Error(
      'Missing KEFG_ANNOUNCEMENTS header(s): ' +
      missingHeaders.join(', ')
    );
  }
}

function KGMIS_buildHeaderIndex_(headers) {
  const index = {};

  headers.forEach(function (header, position) {
    if (header) {
      index[header] = position;
    }
  });

  return index;
}

function KGMIS_isEmptyHeroRow_(row) {
  return row.every(function (value) {
    return value === '' || value === null;
  });
}

function KGMIS_getSheetValue_(row, columnIndex, header) {
  const value = KGMIS_getRawSheetValue_(
    row,
    columnIndex,
    header
  );

  return value == null
    ? ''
    : String(value).trim();
}

function KGMIS_getRawSheetValue_(row, columnIndex, header) {
  const position = columnIndex[header];

  if (position === undefined || position === null) {
    return '';
  }

  return row[position];
}

function KGMIS_toDate_(value) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    Object.prototype.toString.call(value) === '[object Date]'
  ) {
    return isNaN(value.getTime())
      ? null
      : value;
  }

  const date = new Date(value);

  return isNaN(date.getTime())
    ? null
    : date;
}

function KGMIS_isTruthy_(value) {
  if (value === true) {
    return true;
  }

  const text = String(value || '')
    .trim()
    .toUpperCase();

  return ['TRUE', 'YES', 'Y', '1'].includes(text);
}

function KGMIS_normalisePriority_(priority) {
  const value = String(priority || '')
    .trim()
    .toUpperCase();

  const map = {
    URGENT: 1,
    HIGH: 2,
    NORMAL: 3,
    MEDIUM: 3,
    LOW: 4
  };

  return map[value] || 3;
}

function KGMIS_normaliseDisplayOrder_(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 9999;
}

function KGMIS_isEventCategory_(category) {
  const value = String(category || '')
    .trim()
    .toUpperCase();

  return [
    'EVENT',
    'UPCOMING EVENT',
    'FAMILY EVENT',
    'CULTURAL EVENT',
    'MEETING'
  ].includes(value);
}

function KGMIS_buildEventSummary_(
  shortDescription,
  eventLocation
) {
  return [
    String(shortDescription || '').trim(),
    String(eventLocation || '').trim()
  ]
    .filter(Boolean)
    .join(' • ');
}

function KGMIS_sortAnnouncements_(left, right) {
  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  if (left.displayOrder !== right.displayOrder) {
    return left.displayOrder - right.displayOrder;
  }

  return (
    new Date(right.displayFrom || 0).getTime() -
    new Date(left.displayFrom || 0).getTime()
  );
}

function KGMIS_sortEvents_(left, right) {
  const dateDifference =
    new Date(left.eventDate).getTime() -
    new Date(right.eventDate).getTime();

  if (dateDifference !== 0) {
    return dateDifference;
  }

  if (left.priority !== right.priority) {
    return left.priority - right.priority;
  }

  return left.displayOrder - right.displayOrder;
}
