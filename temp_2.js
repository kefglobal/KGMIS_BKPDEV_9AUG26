function KGMIS_TestTreasurerPortalConfiguration() {
  const result =
    getPortalConfiguration();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}