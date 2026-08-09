function KEFG_Spouse_Copy_Data_To_New_Row_(sheet, sourceRow, newRow) {
  const H = KEFG_SPOUSE_CONFIG.HEADERS;

  const mappings = [
    [H.SPOUSE_NAME, H.MEMBER_NAME],
    [H.SPOUSE_MOBILE, H.MEMBER_MOBILE],
    [H.SPOUSE_ALUMNI, H.ALUMNI],
    [H.SPOUSE_DISTRICT, H.CURRENT_DISTRICT],
    [H.SPOUSE_ACTIVITIES, H.ACTIVITIES],
    [H.SPOUSE_BIRTHDAY, H.MEMBER_BIRTHDAY],
    [H.WEDDING_DATE, H.WEDDING_DATE],
    [H.ZONE, H.ZONE],
    [H.SUBSCRIPTION_2026, H.SUBSCRIPTION_2026],
    [H.SUBSCRIPTION_2025, H.SUBSCRIPTION_2025],
    [H.WHATSAPP_NUMBER, H.WHATSAPP_NUMBER],
    [H.SPOUSE_BATCH, H.YEAR_BATCH],
    [H.SPOUSE_PROFESSION, H.PROFESSION],
    [H.SPOUSE_CONTRIBUTIONS, H.CONTRIBUTIONS],
    [H.SPOUSE_VOLUNTEER, H.VOLUNTEER],
    [H.SPOUSE_BRANCH, H.BRANCH],
    [H.CONSENT, H.CONSENT]
  ];

  mappings.forEach(([sourceHeader, targetHeader]) => {
    const sourceCol = KEFG_Spouse_GetColumn_(sheet, sourceHeader);
    const targetCol = KEFG_Spouse_GetColumn_(sheet, targetHeader);

    const value = sheet.getRange(sourceRow, sourceCol).getValue();

    if (value !== "" && value !== null) {
      sheet.getRange(newRow, targetCol).setValue(value);
    }
  });
}