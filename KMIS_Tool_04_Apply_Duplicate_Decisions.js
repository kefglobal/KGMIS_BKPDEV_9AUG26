function KMIS_Apply_Duplicate_Decisions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const reviewName = "KMIS_CRITICAL_DUPLICATES";

  const master = ss.getSheetByName(masterName);
  const review = ss.getSheetByName(reviewName);

  if (!master) throw new Error("Master sheet not found: " + masterName);
  if (!review) throw new Error("Duplicate review sheet not found: " + reviewName);

  const reviewData = review.getDataRange().getDisplayValues();
  if (reviewData.length < 2) {
    SpreadsheetApp.getUi().alert("No duplicate decisions found.");
    return;
  }

  const reviewHeaders = reviewData[0];

  const actionCol = reviewHeaders.indexOf("ACTION");
  const tempIdColReview = reviewHeaders.indexOf("TEMP_ID");

  if (actionCol === -1 || tempIdColReview === -1) {
    throw new Error("ACTION or TEMP_ID column not found in duplicate review sheet.");
  }

  const deleteIds = new Set();
  let keepCount = 0;
  let reviewCount = 0;
  let deleteDecisionCount = 0;

  for (let i = 1; i < reviewData.length; i++) {
    const action = String(reviewData[i][actionCol] || "").trim().toUpperCase();
    const tempId = String(reviewData[i][tempIdColReview] || "").trim();

    if (action === "DELETE" && tempId) {
      deleteIds.add(tempId);
      deleteDecisionCount++;
    } else if (action === "KEEP") {
      keepCount++;
    } else if (action === "REVIEW") {
      reviewCount++;
    }
  }

  if (deleteIds.size === 0) {
    SpreadsheetApp.getUi().alert(
      "No records marked DELETE.\n\nNothing was changed."
    );
    return;
  }

  const masterLastRow = master.getLastRow();
  const masterLastCol = master.getLastColumn();

  const masterHeaders = master
    .getRange(1, 1, 1, masterLastCol)
    .getDisplayValues()[0];

  const tempIdColMaster = masterHeaders.indexOf("TEMP_ID");

  if (tempIdColMaster === -1) {
    throw new Error("TEMP_ID column not found in master database.");
  }

  const masterData = master
    .getRange(2, 1, masterLastRow - 1, masterLastCol)
    .getDisplayValues();

  const idToRows = {};

  for (let i = 0; i < masterData.length; i++) {
    const id = String(masterData[i][tempIdColMaster] || "").trim();
    if (!id) continue;

    if (!idToRows[id]) idToRows[id] = [];
    idToRows[id].push(i + 2);
  }

  const rowsToDelete = [];
  const skipped = [];

  deleteIds.forEach(id => {
    const rows = idToRows[id] || [];

    if (rows.length === 1) {
      rowsToDelete.push(rows[0]);
    } else if (rows.length === 0) {
      skipped.push([id, "TEMP_ID not found in master database"]);
    } else {
      skipped.push([id, "TEMP_ID appears multiple times in master database"]);
    }
  });

  rowsToDelete.sort((a, b) => b - a);

  rowsToDelete.forEach(rowNumber => {
    master.deleteRow(rowNumber);
  });

  const logName = "KMIS_DUPLICATE_DELETE_LOG";
  let log = ss.getSheetByName(logName);
  if (log) log.clear();
  else log = ss.insertSheet(logName);

  const logOutput = [
  ["KMIS DUPLICATE DELETE LOG", ""],
  ["Generated On", new Date()],
  ["Master Sheet", masterName],
  ["Review Sheet", reviewName],
  ["DELETE decisions", deleteDecisionCount],
  ["Unique TEMP_IDs marked DELETE", deleteIds.size],
  ["Rows deleted", rowsToDelete.length],
  ["Rows skipped", skipped.length],
  ["KEEP rows", keepCount],
  ["REVIEW rows", reviewCount],
  ["", ""],
  ["SKIPPED TEMP_ID", "REASON"]
];

  skipped.forEach(s => logOutput.push(s));

  log.getRange(1, 1, logOutput.length, 2).setValues(logOutput);
  log.autoResizeColumns(1, 2);

  SpreadsheetApp.getUi().alert(
    "Duplicate decisions applied.\n\n" +
    "Rows deleted: " + rowsToDelete.length + "\n" +
    "Rows skipped: " + skipped.length + "\n\n" +
    "Log sheet: " + logName
  );
}