/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Module — Utilities
 *
 * File:
 * 30.06_KGMIS_Treasurer_Utilities.gs
 * ============================================================
 *
 * Contains:
 * - Text cleaning
 * - Search normalization
 * - HTML date formatting
 * - Display date formatting
 * - Safe date conversion
 */


/**
 * ============================================================
 * Clean Value
 * ============================================================
 *
 * Converts null or undefined values to an empty string
 * and trims surrounding spaces.
 */
function KGMIS_Treasurer_CleanValue_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


/**
 * ============================================================
 * Normalize Search Value
 * ============================================================
 *
 * Converts values into a consistent format for searches
 * and comparisons.
 */
function KGMIS_Treasurer_NormalizeSearchValue_(
  value
) {
  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}


/**
 * ============================================================
 * Format Date for HTML
 * ============================================================
 *
 * Returns a date in YYYY-MM-DD format for an HTML date input.
 */
function KGMIS_Treasurer_FormatDateForHtml_(
  value
) {
  const date =
    KGMIS_Treasurer_ConvertToDate_(
      value
    );

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


/**
 * ============================================================
 * Format Date for Display
 * ============================================================
 *
 * Returns a readable date such as:
 * 12-Jul-2026
 */
function KGMIS_Treasurer_FormatDateForDisplay_(
  value
) {
  const date =
    KGMIS_Treasurer_ConvertToDate_(
      value
    );

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    KGMIS_TREASURER_DATA_CONFIG
      .DATE_DISPLAY_FORMAT
  );
}


/**
 * ============================================================
 * Convert Value to Date
 * ============================================================
 *
 * Supports:
 * - Native Date objects
 * - YYYY-MM-DD
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - DD.MM.YYYY
 */
function KGMIS_Treasurer_ConvertToDate_(
  value
) {
  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  const text =
    KGMIS_Treasurer_CleanValue_(
      value
    );

  if (!text) {
    return null;
  }

  const isoMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})/
  );

  if (isoMatch) {
    const year =
      Number(isoMatch[1]);

    const monthIndex =
      Number(isoMatch[2]) - 1;

    const day =
      Number(isoMatch[3]);

    const date =
      new Date(
        year,
        monthIndex,
        day
      );

    if (
      date.getFullYear() === year &&
      date.getMonth() === monthIndex &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  const dayFirstMatch = text.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/
  );

  if (dayFirstMatch) {
    const day =
      Number(dayFirstMatch[1]);

    const monthIndex =
      Number(dayFirstMatch[2]) - 1;

    const year =
      Number(dayFirstMatch[3]);

    const date =
      new Date(
        year,
        monthIndex,
        day
      );

    if (
      date.getFullYear() === year &&
      date.getMonth() === monthIndex &&
      date.getDate() === day
    ) {
      return date;
    }

    return null;
  }

  return null;
}