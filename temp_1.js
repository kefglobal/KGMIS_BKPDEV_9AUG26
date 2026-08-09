function KGMIS_TestTimeZone() {

  const now = new Date();

  Logger.log("Script Time Zone : " + Session.getScriptTimeZone());

  Logger.log("Raw Date Object  : " + now);

  Logger.log(
    "Formatted Time    : " +
    Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      "dd-MMM-yyyy HH:mm:ss"
    )
  );

}