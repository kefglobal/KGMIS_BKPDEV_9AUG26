/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Module — Reports
 *
 * File:
 * 30.05_KGMIS_Treasurer_Reports.gs
 * ============================================================
 */


/**
 * Generates the subscription report.
 *
 * Overall summary:
 * Calculated from all families before filters.
 *
 * Filtered rows:
 * Used only for the displayed report table.
 */
function KGMIS_Treasurer_GetSubscriptionReport(
  filters
) {
  KGMIS_RequireModuleAccess_(
    KGMIS_TREASURER_CONFIG.MODULE_NAME,
    KGMIS_TREASURER_CONFIG.VIEW_ACTION
  );

  const safeFilters = filters || {};

  const zoneFilter =
    KGMIS_Treasurer_NormalizeSearchValue_(
      safeFilters.zone
    );

  const statusFilter =
    KGMIS_Treasurer_NormalizeSearchValue_(
      safeFilters.status
    );

  const textFilter =
    KGMIS_Treasurer_NormalizeSearchValue_(
      safeFilters.searchText
    );

  const context =
    KGMIS_Treasurer_GetContext_();

  const familyMap =
    KGMIS_Treasurer_BuildFamilyMap_(
      context
    );

  /*
   * Complete family list before filters.
   */
  const allFamilies =
    Array.from(
      familyMap.values()
    ).sort(
      KGMIS_Treasurer_CompareFamilies_
    );

  /*
   * Overall totals for dashboard cards.
   */
  const overallSummary =
    KGMIS_Treasurer_CreateReportSummary_(
      allFamilies
    );

  /*
   * Apply filters only to the table rows.
   */
  const filteredRows =
    allFamilies.filter(family => {
      if (
        zoneFilter &&
        KGMIS_Treasurer_NormalizeSearchValue_(
          family.zone
        ) !== zoneFilter
      ) {
        return false;
      }

      if (
        statusFilter &&
        KGMIS_Treasurer_NormalizeSearchValue_(
          family.subscriptionStatus
        ) !== statusFilter
      ) {
        return false;
      }

      if (textFilter) {
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

        return searchableValues.some(
          value =>
            value.includes(textFilter)
        );
      }

      return true;
    });

  /*
   * Optional filtered summary.
   */
  const filteredSummary =
    KGMIS_Treasurer_CreateReportSummary_(
      filteredRows
    );

  return {
    rows: filteredRows,

    /*
     * Used by the five summary cards.
     */
    summary: overallSummary,

    /*
     * Available if later needed.
     */
    filteredSummary,

    filteredCount:
      filteredRows.length,

    totalCount:
      allFamilies.length
  };
}


/**
 * Creates a subscription-status summary.
 */
function KGMIS_Treasurer_CreateReportSummary_(
  rows
) {
  const safeRows =
    Array.isArray(rows)
      ? rows
      : [];

  const summary = {
    total: safeRows.length,
    paid: 0,
    notPaid: 0,
    pending: 0,
    exempted: 0
  };

  safeRows.forEach(row => {
    const status =
      KGMIS_Treasurer_GetEffectiveSubscriptionStatus_(
        row &&
          row.subscriptionStatus
      );

    switch (status) {
      case 'PAID':
        summary.paid++;
        break;

      case 'PENDING':
        summary.pending++;
        break;

      case 'EXEMPTED':
        summary.exempted++;
        break;

      case 'NOT PAID':
      default:
        summary.notPaid++;
        break;
    }
  });

  return summary;
}


/**
 * Compatibility wrapper used by Index.html.
 */
function getSubscriptionReport(filters) {
  return KGMIS_Treasurer_GetSubscriptionReport(
    filters
  );
}
