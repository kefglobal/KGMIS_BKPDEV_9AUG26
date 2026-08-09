function KEFG_Date_Parse_Value_(rawValue, displayValue) {
  const display = KEFG_Date_Normalize_(displayValue);

  if (display === "") {
    return { status: "BLANK", fullDate: null, displayDate: "" };
  }

  if (/^(n\/a|na|not applicable)$/i.test(display)) {
    return { status: "NOT_APPLICABLE", fullDate: null, displayDate: "" };
  }

  if (rawValue instanceof Date) {
    return buildDateResult_(rawValue, "READY");
  }

  if (typeof rawValue === "number") {
    const date = new Date(1899, 11, 30 + rawValue);
    return buildDateResult_(date, "READY");
  }

  // 29-05 / 29/05 / 29.05
  let m = display.match(/^(\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    return makeSafeDate_(Number(m[1]), Number(m[2]), KEFG_DATE.PLACEHOLDER_YEAR);
  }

  // 29-05-1956 / 29/05/1956 / 29.05.1956
  m = display.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    let year = Number(m[3]);
    if (year < 100) year += 1900;
    return makeSafeDate_(Number(m[1]), Number(m[2]), year);
  }

  // 29 May / 29th May
  m = display.match(/^(\d{1,2})(st|nd|rd|th)?\s+([A-Za-z]+)$/i);
  if (m) {
    const month = KEFG_Date_MonthNumber_(m[3]);
    return makeSafeDate_(Number(m[1]), month, KEFG_DATE.PLACEHOLDER_YEAR);
  }

  // May 29
  m = display.match(/^([A-Za-z]+)\s+(\d{1,2})$/i);
  if (m) {
    const month = KEFG_Date_MonthNumber_(m[1]);
    return makeSafeDate_(Number(m[2]), month, KEFG_DATE.PLACEHOLDER_YEAR);
  }

  return { status: "REVIEW", fullDate: null, displayDate: "" };
}

function makeSafeDate_(day, month, year) {
  if (!day || !month || !year) {
    return { status: "REVIEW", fullDate: null, displayDate: "" };
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return { status: "REVIEW", fullDate: null, displayDate: "" };
  }

  return buildDateResult_(date, "READY");
}

function buildDateResult_(date, status) {
  return {
    status: status,
    fullDate: date,
    displayDate: KEFG_Date_Format_(date, KEFG_DATE.DISPLAY_FORMAT)
  };
}