function KMIS_Validate_Duplicate_Decisions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const reviewName = "KMIS_CRITICAL_DUPLICATES";
  const resultName = "KMIS_DUPLICATE_DECISION_VALIDATION";

  const review = ss.getSheetByName(reviewName);
  if (!review) throw new Error("Duplicate review sheet not found: " + reviewName);

  const data = review.getDataRange().getDisplayValues();
  if (data.length < 2) {
    SpreadsheetApp.getUi().alert("No duplicate review rows found.");
    return;
  }

  const headers = data[0];
  const actionCol = headers.indexOf("ACTION");
  const tempIdCol = headers.indexOf("TEMP_ID");
  const nameCol = headers.indexOf("MEMBER_NAME");

  if (actionCol === -1 || tempIdCol === -1) {
    throw new Error("ACTION or TEMP_ID column not found.");
  }

  const decisions = {};

  for (let i = 1; i < data.length; i++) {
    const action = String(data[i][actionCol] || "").trim().toUpperCase();
    const tempId = String(data[i][tempIdCol] || "").trim();
    const name = nameCol === -1 ? "" : data[i][nameCol];

    if (!tempId) continue;
    if (!action) continue;

    if (!decisions[tempId]) {
      decisions[tempId] = {
        name: name,
        actions: new Set(),
        rows: []
      };
    }

    decisions[tempId].actions.add(action);
    decisions[tempId].rows.push(i + 1);
  }

  const output = [[
    "STATUS",
    "TEMP_ID",
    "MEMBER_NAME",
    "ACTIONS_FOUND",
    "REVIEW_ROWS",
    "REMARK"
  ]];

  let conflictCount = 0;

  Object.keys(decisions).forEach(tempId => {
    const item = decisions[tempId];
    const actions = Array.from(item.actions).sort();

    const hasDelete = item.actions.has("DELETE");
    const hasKeep = item.actions.has("KEEP");
    const hasReview = item.actions.has("REVIEW");

    let status = "PASS";
    let remark = "No conflict";

    if (hasDelete && hasKeep) {
      status = "FAIL";
      remark = "TEMP_ID is marked both DELETE and KEEP";
    } else if (hasDelete && hasReview) {
      status = "FAIL";
      remark = "TEMP_ID is marked both DELETE and REVIEW";
    }

    if (status === "FAIL") conflictCount++;

    output.push([
      status,
      tempId,
      item.name,
      actions.join(", "),
      item.rows.join(", "),
      remark
    ]);
  });

  let result = ss.getSheetByName(resultName);
  if (result) result.clear();
  else result = ss.insertSheet(resultName);

  result.getRange(1, 1, output.length, output[0].length).setValues(output);
  result.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    conflictCount === 0
      ? "Duplicate decision validation PASSED.\n\nReady to apply delete decisions."
      : "Duplicate decision validation FAILED.\n\nConflicts found: " + conflictCount +
        "\n\nCheck sheet: " + resultName
  );
}