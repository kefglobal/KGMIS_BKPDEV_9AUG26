const KEFG_DATE = {
  MASTER_SHEET: "KEFG_MASTER_DATABASE_v1.0",
  PREVIEW_SHEET: "KEFG_DATE_CLEANUP_PREVIEW",

  HEADER_ROW: 1,
  FIRST_DATA_ROW: 2,

  PLACEHOLDER_YEAR: 2000,

  DISPLAY_FORMAT: "dd MMM",
  FULL_FORMAT: "dd-MMM-yyyy",

  FIELDS: [
    {
      displayHeader: "MEMBER BIRTHDAY (Date and Month)",
      fullHeader: "MEMBER_DOB_FULL"
    },
    {
      displayHeader: "SPOUSE BIRTHDAY (Date and Month)",
      fullHeader: "SPOUSE_DOB_FULL"
    },
    {
      displayHeader: "WEDDING DATE",
      fullHeader: "WEDDING_DATE_FULL"
    }
  ]
};