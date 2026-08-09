function KMIS_Create_KEFG_ID_Preview() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const previewName = "KMIS_KEFG_ID_PREVIEW";

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
    RELATED_KEFG_ID: col("RELATED_KEFG_ID"),
    MEMBER_CATEGORY: col("MEMBER_CATEGORY"),
    MEMBER_NAME: col("MEMBER_NAME"),
    SUB_2025: col("SUBSCRIPTION_STATUS_2025_2026"),
    SUB_2026: col("SUBSCRIPTION_STATUS_2026_2027")
  };

  const rawData = lastRow > 1
    ? master.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues()
    : [];

  // ignore blank TEMP_ID rows
  const data = rawData.filter(r => String(r[C.TEMP_ID] || "").trim() !== "");

  const idMap = {};
  data.forEach(row => {
    idMap[String(row[C.TEMP_ID]).trim()] = row;
  });

  function isPaid(v) {
    return String(v || "").trim().toUpperCase() === "PAID";
  }

  const processed = new Set();
  const units = [];

  data.forEach(row => {
    const id = String(row[C.TEMP_ID]).trim();
    if (processed.has(id)) return;

    const relatedId = String(row[C.RELATED_KEFG_ID] || "").trim();
    const relatedRow = idMap[relatedId];

    let unitRows = [row];

    if (relatedRow) {
      unitRows.push(relatedRow);
    } else {
      // also check if someone points to this row
      data.forEach(other => {
        const otherRelated = String(other[C.RELATED_KEFG_ID] || "").trim();
        const otherId = String(other[C.TEMP_ID] || "").trim();
        if (otherRelated === id && otherId !== id) {
          unitRows.push(other);
        }
      });
    }

    // remove duplicates inside unit
    const unique = [];
    const seen = new Set();

    unitRows.forEach(r => {
      const rid = String(r[C.TEMP_ID]).trim();
      if (!seen.has(rid)) {
        unique.push(r);
        seen.add(rid);
      }
    });

    // primary first
    unique.sort((a, b) => {
      const ca = String(a[C.MEMBER_CATEGORY] || "").trim().toUpperCase();
      const cb = String(b[C.MEMBER_CATEGORY] || "").trim().toUpperCase();

      if (ca === "PRIMARY MEMBER" && cb !== "PRIMARY MEMBER") return -1;
      if (cb === "PRIMARY MEMBER" && ca !== "PRIMARY MEMBER") return 1;

      return String(a[C.MEMBER_NAME] || "").localeCompare(String(b[C.MEMBER_NAME] || ""));
    });

    const primary = unique.find(r =>
      String(r[C.MEMBER_CATEGORY] || "").trim().toUpperCase() === "PRIMARY MEMBER"
    ) || unique[0];

    let group = "C_REST";

    if (unique.some(r => isPaid(r[C.SUB_2025]))) {
      group = "A_2025_2026_PAID";
    } else if (unique.some(r => isPaid(r[C.SUB_2026]))) {
      group = "B_2026_2027_PAID";
    }

    units.push({
      group: group,
      sortName: String(primary[C.MEMBER_NAME] || "").trim().toUpperCase(),
      rows: unique
    });

    unique.forEach(r => processed.add(String(r[C.TEMP_ID]).trim()));
  });

  const rank = {
    "A_2025_2026_PAID": 1,
    "B_2026_2027_PAID": 2,
    "C_REST": 3
  };

  units.sort((a, b) => {
    const g = rank[a.group] - rank[b.group];
    if (g !== 0) return g;
    return a.sortName.localeCompare(b.sortName);
  });

  const oldToNew = {};
  const oldToGroup = {};
  let nextNo = 1001;

  units.forEach(unit => {
    unit.rows.forEach(row => {
      const oldId = String(row[C.TEMP_ID]).trim();
      oldToNew[oldId] = "KEFG" + nextNo++;
      oldToGroup[oldId] = unit.group;
    });
  });

  const output = [[
    "ACTION",
    "GROUP",
    "OLD_TEMP_ID",
    "NEW_KEFG_ID",
    "MEMBER_NAME",
    "MEMBER_CATEGORY",
    "OLD_RELATED_KEFG_ID",
    "NEW_RELATED_KEFG_ID",
    "REMARK"
  ]];

  let missingNewId = 0;

  data.forEach(row => {
    const oldId = String(row[C.TEMP_ID]).trim();
    const oldRelated = String(row[C.RELATED_KEFG_ID] || "").trim();

    if (!oldToNew[oldId]) missingNewId++;

    output.push([
      "APPLY",
      oldToGroup[oldId] || "",
      oldId,
      oldToNew[oldId] || "",
      row[C.MEMBER_NAME],
      row[C.MEMBER_CATEGORY],
      oldRelated,
      oldToNew[oldRelated] || "",
      !oldToNew[oldId] ? "NEW ID NOT ASSIGNED" :
      oldRelated && !oldToNew[oldRelated] ? "Related ID not found in master" : ""
    ]);
  });

  preview.getRange(1, 1, output.length, output[0].length).setValues(output);
  preview.setFrozenRows(1);

  SpreadsheetApp.getUi().alert(
    "KEFG ID preview created.\n\n" +
    "Records mapped: " + (output.length - 1) + "\n" +
    "Missing NEW_KEFG_ID: " + missingNewId + "\n" +
    "First ID: KEFG1001\n" +
    "Last ID: KEFG" + (nextNo - 1)
  );
}