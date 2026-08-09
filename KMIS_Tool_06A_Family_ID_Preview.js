function KMIS_Create_Family_ID_Preview() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const previewName = "KMIS_FAMILY_ID_PREVIEW";

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found: " + masterName);

  const oldPreview = ss.getSheetByName(previewName);
  if (oldPreview) ss.deleteSheet(oldPreview);
  const preview = ss.insertSheet(previewName);

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();
  const headers = master.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  function col(h) {
    const i = headers.indexOf(h);
    if (i === -1) throw new Error("Header not found: " + h);
    return i;
  }

  const C = {
    TEMP_ID: col("TEMP_ID"),
    FAMILY_ID: col("FAMILY_ID"),
    RELATED_KEFG_ID: col("RELATED_KEFG_ID"),
    MEMBER_NAME: col("MEMBER_NAME"),
    MEMBER_CATEGORY: col("MEMBER_CATEGORY")
  };

  const data = lastRow > 1
    ? master.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues()
    : [];

  const idToRow = {};
  data.forEach(row => {
    const id = String(row[C.TEMP_ID] || "").trim();
    if (id) idToRow[id] = row;
  });

  const visited = new Set();
  const families = [];

  data.forEach(row => {
    const id = String(row[C.TEMP_ID] || "").trim();
    if (!id || visited.has(id)) return;

    const relatedId = String(row[C.RELATED_KEFG_ID] || "").trim();
    const relatedRow = relatedId ? idToRow[relatedId] : null;

    const familyRows = [row];
    visited.add(id);

    if (relatedRow) {
      const rid = String(relatedRow[C.TEMP_ID] || "").trim();
      if (rid && !visited.has(rid)) {
        familyRows.push(relatedRow);
        visited.add(rid);
      }
    }

    familyRows.sort((a, b) => {
      const ca = String(a[C.MEMBER_CATEGORY] || "").trim().toUpperCase();
      const cb = String(b[C.MEMBER_CATEGORY] || "").trim().toUpperCase();

      if (ca === "PRIMARY MEMBER" && cb !== "PRIMARY MEMBER") return -1;
      if (cb === "PRIMARY MEMBER" && ca !== "PRIMARY MEMBER") return 1;

      return String(a[C.MEMBER_NAME] || "").localeCompare(String(b[C.MEMBER_NAME] || ""));
    });

    families.push(familyRows);
  });

  const familyMap = {};
  let familyNo = 1;

  families.forEach(familyRows => {
    const famId = "FAM" + String(familyNo++).padStart(5, "0");

    familyRows.forEach(row => {
      const id = String(row[C.TEMP_ID] || "").trim();
      familyMap[id] = famId;
    });
  });

  const output = [[
    "ACTION",
    "TEMP_ID",
    "MEMBER_NAME",
    "MEMBER_CATEGORY",
    "RELATED_KEFG_ID",
    "CURRENT_FAMILY_ID",
    "NEW_FAMILY_ID",
    "REMARK"
  ]];

  data.forEach(row => {
    const id = String(row[C.TEMP_ID] || "").trim();
    const relatedId = String(row[C.RELATED_KEFG_ID] || "").trim();

    output.push([
      "APPLY",
      id,
      row[C.MEMBER_NAME],
      row[C.MEMBER_CATEGORY],
      relatedId,
      row[C.FAMILY_ID],
      familyMap[id] || "",
      relatedId && !idToRow[relatedId] ? "RELATED_KEFG_ID not found" : ""
    ]);
  });

  preview.getRange(1, 1, output.length, output[0].length).setValues(output);
  preview.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "Family ID preview created.\n\n" +
    "Records listed: " + (output.length - 1) + "\n" +
    "Families created: " + families.length + "\n" +
    "First Family ID: FAM00001\n" +
    "Last Family ID: FAM" + String(families.length).padStart(5, "0")
  );
}