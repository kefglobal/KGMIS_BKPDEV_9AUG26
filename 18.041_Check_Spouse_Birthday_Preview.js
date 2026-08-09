function KEFG_Check_Spouse_Birthday_Preview() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const preview = ss.getSheetByName("KEFG_DATE_CLEANUP_PREVIEW");

  const data = preview.getDataRange().getValues();

  let apply = 0;
  let review = 0;
  let skip = 0;

  for (let i = 1; i < data.length; i++) {
    const action = String(data[i][0] || "").trim();
    const field = String(data[i][3] || "").trim();

    if (field === "SPOUSE BIRTHDAY (Date and Month)") {
      if (action === "APPLY") {
        apply++;
      } else if (action === "REVIEW") {
        review++;
      } else {
        skip++;
      }
    }
  }

  SpreadsheetApp.getUi().alert(
    "SPOUSE BIRTHDAY Preview\n\n" +
    "APPLY : " + apply + "\n" +
    "REVIEW : " + review + "\n" +
    "SKIP : " + skip
  );
}