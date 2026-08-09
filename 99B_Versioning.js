function KEFG_Update_System_Version() {
  const systemSheet = KEFG_getSystemSheet_();

  systemSheet.getRange("A3:B3").setValues([
    ["SCRIPT_VERSION", "1.0"]
  ]);

  systemSheet.getRange("A4:B4").setValues([
    ["VERSION_UPDATED_ON", new Date()]
  ]);

  SpreadsheetApp.getUi().alert(
    "KEFG Member Database Manager updated to version 1.0"
  );
}