function KEFG_Import_Response1_By_TEMP_ID() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterSheet = ss.getSheetByName("KEFG_Test_Data_Rev_0.1");
  const responseSheet = ss.getSheetByName("Response-1");

  if (!masterSheet) throw new Error('Master sheet not found: KEFG_Test_Data_Rev_0.1');
  if (!responseSheet) throw new Error('Response sheet not found: Response-1');

  const HEADER_ROW = 1;
  const FIRST_DATA_ROW = 2;
  const ID_HEADER = "TEMP_ID";

  // Add missing headers from Response-1 to Master
  addMissingHeaders_(masterSheet, responseSheet, HEADER_ROW);

  const masterHeaders = getHeaders_(masterSheet, HEADER_ROW);
  const responseHeaders = getHeaders_(responseSheet, HEADER_ROW);

  const masterIdCol = getHeaderIndex_(masterHeaders, ID_HEADER);
  const responseIdCol = getHeaderIndex_(responseHeaders, ID_HEADER);

  if (masterIdCol === -1) throw new Error("TEMP_ID header not found in master sheet.");
  if (responseIdCol === -1) throw new Error("TEMP_ID header not found in Response-1.");

  const masterLastRow = masterSheet.getLastRow();
  const responseLastRow = responseSheet.getLastRow();

  if (responseLastRow < FIRST_DATA_ROW) {
    SpreadsheetApp.getUi().alert("No data found in Response-1.");
    return;
  }

  const masterData = masterSheet
    .getRange(FIRST_DATA_ROW, 1, masterLastRow - FIRST_DATA_ROW + 1, masterSheet.getLastColumn())
    .getValues();

  const responseData = responseSheet
    .getRange(FIRST_DATA_ROW, 1, responseLastRow - FIRST_DATA_ROW + 1, responseSheet.getLastColumn())
    .getValues();

  // Build TEMP_ID → master row number map
  const idToMasterRow = {};

  for (let i = 0; i < masterData.length; i++) {
    const id = String(masterData[i][masterIdCol] || "").trim();

    if (id !== "") {
      idToMasterRow[id] = i + FIRST_DATA_ROW;
    }
  }

  let updatedRows = 0;
  let updatedCells = 0;
  let skippedBlankCells = 0;
  let skippedNoId = 0;
  let skippedIdNotFound = 0;

  for (let r = 0; r < responseData.length; r++) {
    const responseRow = responseData[r];
    const tempId = String(responseRow[responseIdCol] || "").trim();

    if (tempId === "") {
      skippedNoId++;
      continue;
    }

    const masterRowNumber = idToMasterRow[tempId];

    if (!masterRowNumber) {
      skippedIdNotFound++;
      continue;
    }

    let rowUpdated = false;

    for (let c = 0; c < responseHeaders.length; c++) {
      const header = String(responseHeaders[c] || "").trim();

      if (header === "") continue;
      if (header === ID_HEADER) continue;

      const value = responseRow[c];

      if (value === "" || value === null) {
        skippedBlankCells++;
        continue;
      }

      const masterColIndex = getHeaderIndex_(masterHeaders, header);

      if (masterColIndex === -1) continue;

      masterSheet
        .getRange(masterRowNumber, masterColIndex + 1)
        .setValue(value);

      updatedCells++;
      rowUpdated = true;
    }

    if (rowUpdated) updatedRows++;
  }

  SpreadsheetApp.getUi().alert(
    "Response-1 import completed.\n\n" +
    "Rows updated: " + updatedRows + "\n" +
    "Cells updated: " + updatedCells + "\n" +
    "Blank cells skipped: " + skippedBlankCells + "\n" +
    "Rows skipped - no TEMP_ID: " + skippedNoId + "\n" +
    "Rows skipped - TEMP_ID not found: " + skippedIdNotFound
  );
}

function getHeaders_(sheet, headerRow) {
  return sheet
    .getRange(headerRow, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(h => String(h || "").trim());
}

function getHeaderIndex_(headers, headerName) {
  const target = normalizeHeader_(headerName);

  for (let i = 0; i < headers.length; i++) {
    if (normalizeHeader_(headers[i]) === target) {
      return i;
    }
  }

  return -1;
}

function normalizeHeader_(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function addMissingHeaders_(masterSheet, responseSheet, headerRow) {
  const masterHeaders = getHeaders_(masterSheet, headerRow);
  const responseHeaders = getHeaders_(responseSheet, headerRow);

  const existing = masterHeaders.map(h => normalizeHeader_(h));

  responseHeaders.forEach(header => {
    if (header === "") return;

    if (!existing.includes(normalizeHeader_(header))) {
      const newCol = masterSheet.getLastColumn() + 1;
      masterSheet.getRange(headerRow, newCol).setValue(header);
      existing.push(normalizeHeader_(header));
    }
  });
}