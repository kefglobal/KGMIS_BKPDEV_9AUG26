function KEFG_Set_Founder_ID_Reservation() {
  const systemSheet = KEFG_getSystemSheet_();

  systemSheet.getRange("A5:B5").setValues([
    ["RESERVED_FOUNDER_IDS", 40]
  ]);

  const currentLastIssued = Number(systemSheet.getRange("B2").getValue() || 0);

  if (currentLastIssued < 40) {
    systemSheet.getRange("A2:B2").setValues([
      ["LAST_ISSUED_ID", 40]
    ]);
  }

  SpreadsheetApp.getUi().alert(
    "Founder ID reservation completed.\n\n" +
    "TEMP_001 to TEMP_040 are reserved for Founder Members.\n" +
    "Regular IDs will start from TEMP_041."
  );
}