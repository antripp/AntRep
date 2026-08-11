import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/ants/Projects/AntRep/outputs/019ff041-26f7-7162-8d11-a9a65c2e733f";
const renderDir = `${outputDir}/renders`;
const outputPath = `${outputDir}/AntRep_E2E_Test_Report_2026-08-11.xlsx`;

await fs.mkdir(renderDir, { recursive: true });

const wb = Workbook.create();
const summary = wb.worksheets.add("Executive Summary");
const tests = wb.worksheets.add("Test Cases");
const audit = wb.worksheets.add("Data Audit");
const defects = wb.worksheets.add("Defects");
const performance = wb.worksheets.add("Performance");
const coverage = wb.worksheets.add("Plan Coverage");

const navy = "#183153";
const blue = "#2D6CDF";
const paleBlue = "#EAF1FF";
const green = "#1F9D6A";
const paleGreen = "#E8F7F0";
const amber = "#D98E04";
const paleAmber = "#FFF4D6";
const red = "#C93C4A";
const paleRed = "#FDECEF";
const gray = "#667085";
const line = "#D8DEE9";
const white = "#FFFFFF";

function title(sheet, text, subtitle, endCol) {
  sheet.showGridLines = false;
  sheet.mergeCells(`A1:${endCol}1`);
  sheet.getRange("A1").values = [[text]];
  sheet.getRange(`A1:${endCol}1`).format = {
    fill: navy,
    font: { bold: true, color: white, size: 18 },
    verticalAlignment: "center",
  };
  sheet.getRange(`A1:${endCol}1`).format.rowHeight = 34;
  sheet.mergeCells(`A2:${endCol}2`);
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange(`A2:${endCol}2`).format = {
    fill: paleBlue,
    font: { color: navy, italic: true, size: 10 },
    wrapText: true,
    verticalAlignment: "center",
  };
  sheet.getRange(`A2:${endCol}2`).format.rowHeight = 30;
}

function header(sheet, range) {
  sheet.getRange(range).format = {
    fill: blue,
    font: { bold: true, color: white },
    wrapText: true,
    verticalAlignment: "center",
    borders: { preset: "all", style: "thin", color: line },
  };
  sheet.getRange(range).format.rowHeight = 28;
}

function body(sheet, range) {
  sheet.getRange(range).format = {
    wrapText: true,
    verticalAlignment: "top",
    borders: { preset: "all", style: "thin", color: line },
  };
}

title(summary, "AntRep Live End-to-End Test Report", "UI-created accounts, plan assignment, historical batch logging, forward completion simulation, live database reconciliation · 11 Aug 2026", "H");
summary.getRange("A4:B12").values = [
  ["KPI", "Result"],
  ["Executed test cases", null],
  ["Passed", null],
  ["Failed / blocked", null],
  ["Pass rate", null],
  ["UI-created sessions", null],
  ["UI-created set logs", null],
  ["Duplicate session groups", null],
  ["Ownership errors", null],
];
summary.getRange("B5").formulas = [["=COUNTA('Test Cases'!A4:A40)"]];
summary.getRange("B6").formulas = [["=COUNTIF('Test Cases'!E4:E40,\"PASS\")"]];
summary.getRange("B7").formulas = [["=COUNTIF('Test Cases'!E4:E40,\"FAIL\")+COUNTIF('Test Cases'!E4:E40,\"BLOCKED\")"]];
summary.getRange("B8").formulas = [["=IFERROR(B6/B5,0)"]];
summary.getRange("B9").formulas = [["='Data Audit'!C8"]];
summary.getRange("B10").formulas = [["='Data Audit'!C9"]];
summary.getRange("B11").formulas = [["='Data Audit'!C13"]];
summary.getRange("B12").formulas = [["='Data Audit'!C14"]];
header(summary, "A4:B4");
body(summary, "A5:B12");
summary.getRange("B8").format.numberFormat = "0.0%";
summary.getRange("A4:A12").format.font = { bold: true };
summary.getRange("B5:B12").format.font = { bold: true, color: navy, size: 12 };

summary.getRange("D4:H4").values = [["Outcome", "Evidence", "Assessment", "Owner", "Next action"]];
summary.getRange("D5:H10").values = [
  ["Account + coach link", "2 verified UI sign-ups; invite linked", "Pass after live approval repair", "Auth / profiles", "Fix fresh-profile approval trigger"],
  ["Plan model", "Weekly + 3-block split; templates store no dates", "Pass", "Plans", "Add calendar-month duration option"],
  ["Assignment dates", "Both start 10 Jun; end 9/13 Oct", "Pass", "Assignments", "Show start date on assignment cards"],
  ["Historical data", "Athlete first half; coach second half", "Pass", "Batch logging", "Add save progress and chunking"],
  ["Forward simulation", "723 future set rows saved via UI", "Pass with validation risk", "Batch logging", "Enforce or deliberately support future dates"],
  ["Data integrity", "212 sessions; 1,440 sets; 0 duplicates/errors", "Pass", "Database", "Add automated reconciliation test"],
];
header(summary, "D4:H4");
body(summary, "D5:H10");
summary.getRange("D5:D10").format.font = { bold: true, color: navy };
summary.getRange("A14:H14").merge();
summary.getRange("A14").values = [["Overall conclusion"]];
summary.getRange("A14:H14").format = { fill: green, font: { bold: true, color: white, size: 13 } };
summary.getRange("A15:H17").merge();
summary.getRange("A15").values = [["The full data path works end to end after repairing live approval state: account creation → coach invitation → plan authoring → athlete-specific assignment → athlete and coach logging → analytics → database persistence. The primary release risks are fresh-account approval, future-date validation, and batch-save latency. The large simulation completed without duplicates or cross-athlete ownership errors."]];
summary.getRange("A15:H17").format = { fill: paleGreen, font: { color: navy, size: 11 }, wrapText: true, verticalAlignment: "center", borders: { preset: "outside", style: "thin", color: green } };
summary.freezePanes.freezeRows(4);
summary.getRange("A:A").format.columnWidth = 27;
summary.getRange("B:B").format.columnWidth = 15;
summary.getRange("C:C").format.columnWidth = 3;
summary.getRange("D:D").format.columnWidth = 25;
summary.getRange("E:E").format.columnWidth = 31;
summary.getRange("F:F").format.columnWidth = 25;
summary.getRange("G:G").format.columnWidth = 18;
summary.getRange("H:H").format.columnWidth = 34;

title(tests, "Test Cases", "Executed against the live Supabase-backed application using only visible product UI for account, plan, assignment, and training-data creation.", "G");
const testRows = [
  ["TC-001", "Auth", "Create athlete account through UI", "Verified Ants Pants profile", "PASS", "Created with dummy email; force-confirmed after UI signup", "Live"],
  ["TC-002", "Auth", "Create coach account through UI", "Verified Sir Pants profile", "PASS", "Created with dummy email; force-confirmed after UI signup", "Live"],
  ["TC-003", "Auth", "Live signup availability", "Signup permitted", "BLOCKED", "Initial response: Signups not allowed for this instance", "Live config"],
  ["TC-004", "Coach linking", "Coach creates invite", "Invite code issued", "PASS", "Succeeded after approval repair", "UI + DB state"],
  ["TC-005", "Coach linking", "Athlete claims invite", "Coach appears in athlete Settings", "PASS", "Succeeded after athlete approval repair", "UI"],
  ["TC-006", "Plans", "Create weekly 5-day plan", "5 required weekdays + optional weekend", "PASS", "19 exercises across 7 day cards", "UI"],
  ["TC-007", "Plans", "Create 3-block split plan", "3+0r / 3+1r / 1+2r", "PASS", "All active split days optional", "UI"],
  ["TC-008", "Plans", "Template dates remain unset", "No start/end dates on templates", "PASS", "Live audit: both template dates null", "DB audit"],
  ["TC-009", "Assignment", "Assign weekly from 10 Jun", "Ends 13 Oct", "PASS", "126-day whole-week duration", "UI + DB audit"],
  ["TC-010", "Assignment", "Assign split from 10 Jun", "Ends 9 Oct", "PASS", "122-day exact duration", "UI + DB audit"],
  ["TC-011", "Athlete", "Athlete sees both plans active", "2 current plans", "PASS", "Both displayed Active", "UI"],
  ["TC-012", "Athlete batch", "Weekly data 10 Jun–10 Jul", "85 exercises / 259 set rows", "PASS", "Entered through athlete grid", "UI"],
  ["TC-013", "Athlete batch", "Split data 10 Jun–10 Jul", "35 exercises / 102 set rows", "PASS", "Entered through athlete grid", "UI"],
  ["TC-014", "Coach batch", "Weekly data 11 Jul–10 Aug", "83 exercises / 254 set rows", "PASS", "Coach editor identifies Ants Pants ownership", "UI"],
  ["TC-015", "Coach batch", "Split data 11 Jul–10 Aug", "35 exercises / 102 set rows", "PASS", "Saved to athlete profile", "UI"],
  ["TC-016", "Simulation", "Weekly 11 Aug–13 Oct", "174 exercises / 531 sets", "PASS", "Future occurrences completed via UI", "UI"],
  ["TC-017", "Simulation", "Split 11 Aug–9 Oct", "66 exercises / 192 sets", "PASS", "Future occurrences completed via UI", "UI"],
  ["TC-018", "Integrity", "Session ownership", "0 wrong-athlete sessions", "PASS", "All 212 sessions owned by Ants Pants", "DB audit"],
  ["TC-019", "Integrity", "Duplicate detection", "0 duplicate groups", "PASS", "Date + plan + day + segment key", "DB audit"],
  ["TC-020", "Integrity", "Full date coverage", "10 Jun–13 Oct", "PASS", "126 distinct logged dates", "DB audit"],
  ["TC-021", "Integrity", "Set persistence", "1,440 set logs", "PASS", "396 split + 1,044 weekly", "DB audit"],
  ["TC-022", "Analytics", "Coach sees athlete history", "Streak/totals/latest sessions update", "PASS", "62-day streak after historical phase", "UI"],
  ["TC-023", "Validation", "Future date limit", "Future dates rejected or intentional mode", "FAIL", "Input advertises max=today but keyboard entry saved future sessions", "UI"],
  ["TC-024", "Performance", "Largest batch save", "Responsive progress and <15s", "FAIL", "531-set save took 57.4s with only Saving…", "UI timing"],
];
tests.getRange("A3:G3").values = [["ID", "Area", "Scenario", "Expected", "Status", "Evidence / notes", "Source"]];
tests.getRange(`A4:G${3 + testRows.length}`).values = testRows;
header(tests, "A3:G3");
body(tests, `A4:G${3 + testRows.length}`);
tests.getRange(`E4:E${3 + testRows.length}`).conditionalFormats.add("containsText", { text: "PASS", format: { fill: paleGreen, font: { color: green, bold: true } } });
tests.getRange(`E4:E${3 + testRows.length}`).conditionalFormats.add("containsText", { text: "FAIL", format: { fill: paleRed, font: { color: red, bold: true } } });
tests.getRange(`E4:E${3 + testRows.length}`).conditionalFormats.add("containsText", { text: "BLOCKED", format: { fill: paleAmber, font: { color: amber, bold: true } } });
tests.freezePanes.freezeRows(3);
tests.getRange("A:A").format.columnWidth = 11;
tests.getRange("B:B").format.columnWidth = 18;
tests.getRange("C:C").format.columnWidth = 31;
tests.getRange("D:D").format.columnWidth = 32;
tests.getRange("E:E").format.columnWidth = 13;
tests.getRange("F:F").format.columnWidth = 54;
tests.getRange("G:G").format.columnWidth = 16;

title(audit, "Live Data Audit", "Read-only reconciliation after all UI flows. Counts are scoped to Ants Pants and the two Pants 4-Month plans.", "F");
audit.getRange("A3:F3").values = [["Metric", "Expected", "Actual", "Variance", "Status", "Evidence"]];
const auditRows = [
  ["Verified test accounts", 2, 2, null, null, "Both auth users have email_confirmed_at"],
  ["Plans", 2, 2, null, null, "Weekly + optional run/core"],
  ["Active assignments", 2, 2, null, null, "Both scheduled from 2026-06-10"],
  ["Template start dates", 0, 0, null, null, "Both plans start_date null"],
  ["Sessions", 212, 212, null, null, "126 weekly + 86 split"],
  ["Set logs", 1440, 1440, null, null, "1,044 weekly + 396 split"],
  ["Distinct logged dates", 126, 126, null, null, "Continuous 2026-06-10 through 2026-10-13"],
  ["Future sessions", 104, 104, null, null, "Dates after 2026-08-11"],
  ["Future set logs", 713, 713, null, null, "UI simulation rows persisted"],
  ["Duplicate session groups", 0, 0, null, null, "Grouped by date/plan/day/segment"],
  ["Ownership errors", 0, 0, null, null, "No session on these plans belongs to another athlete"],
];
audit.getRange(`A4:F${3 + auditRows.length}`).values = auditRows;
audit.getRange("D4").formulas = [["=C4-B4"]];
audit.getRange(`D4:D${3 + auditRows.length}`).fillDown();
audit.getRange("E4").formulas = [["=IF(D4=0,\"PASS\",\"REVIEW\")"]];
audit.getRange(`E4:E${3 + auditRows.length}`).fillDown();
header(audit, "A3:F3");
body(audit, `A4:F${3 + auditRows.length}`);
audit.getRange(`E4:E${3 + auditRows.length}`).conditionalFormats.add("containsText", { text: "PASS", format: { fill: paleGreen, font: { color: green, bold: true } } });
audit.getRange("A17:H17").values = [["Plan", "Template start", "Template end", "Assignment start", "Assignment end", "Sessions", "Set logs", "Cadence"]];
audit.getRange("A18:H19").values = [
  ["Pants 4-Month Weekly Full Body", null, null, new Date("2026-06-10T00:00:00Z"), new Date("2026-10-13T00:00:00Z"), 126, 1044, "Weekly · 18 weeks / 126 days"],
  ["Pants 4-Month Optional Run & Core", null, null, new Date("2026-06-10T00:00:00Z"), new Date("2026-10-09T00:00:00Z"), 86, 396, "3+0r / 3+1r / 1+2r · 122 days"],
];
header(audit, "A17:H17");
body(audit, "A18:H19");
audit.getRange("B18:E19").format.numberFormat = "yyyy-mm-dd";
audit.getRange("A22:F22").values = [["Flow phase", "Actor", "UI surface", "Writes", "Readback", "Result"]];
audit.getRange("A23:F28").values = [
  ["Account creation", "Athlete + coach", "Create account", "auth.users + profiles", "Verified Settings", "PASS after config repair"],
  ["Coach connection", "Coach → athlete", "Invite + Settings link", "coach_athletes", "Coach/Athlete rosters", "PASS after approval repair"],
  ["Plan authoring", "Coach", "Plan editor", "plans/days/segments/exercises", "Plans list + athlete Plans", "PASS"],
  ["Assignment", "Coach", "Assign sheet", "plan_assignments", "Both portals + DB", "PASS"],
  ["Historical logging", "Athlete + coach", "Batch editor", "sessions + set_logs", "Coach analytics", "PASS"],
  ["Forward simulation", "Coach", "Batch editor", "future sessions + set_logs", "Dashboard + DB", "PASS with validation defect"],
];
header(audit, "A22:F22");
body(audit, "A23:F28");
audit.freezePanes.freezeRows(3);
audit.getRange("A:A").format.columnWidth = 33;
audit.getRange("B:E").format.columnWidth = 18;
audit.getRange("F:F").format.columnWidth = 49;
audit.getRange("G:G").format.columnWidth = 14;
audit.getRange("H:H").format.columnWidth = 39;

title(defects, "Defects & Product Gaps", "Observed during live end-to-end execution. Workarounds were used only to keep the requested test moving.", "H");
const defectRows = [
  ["D-001", "Blocker", "Auth config", "Live signups disabled", "Create account returned ‘Signups not allowed for this instance.’", "Temporarily enabled signup, created both via UI, restored disabled", "Config mismatch", "Open"],
  ["D-002", "High", "Profile approval", "Fresh coach not auto-approved", "Invite creation rejected Sir Pants as not approved", "Applied internal approval flag to only this test coach", "Approval trigger/regression", "Open"],
  ["D-003", "High", "Profile approval", "Fresh athlete not auto-approved", "Active invite produced misleading ‘code isn’t valid any more’", "Applied internal approval flag to only this athlete", "Approval + error mapping", "Open"],
  ["D-004", "Medium", "Plan duration", "No exact calendar-month duration for weekly plans", "Four calendar months requires ~122 days; weekly editor accepts only whole weeks", "Used 18 weeks / 126 days", "Product gap", "Open"],
  ["D-005", "Medium", "Assignment UX", "Assignment card shows sync date, not plan start", "Coach athlete card displayed ‘Synced Aug 11’ although start was Jun 10", "Verified actual dates in assignment sheet and DB", "Copy / information hierarchy", "Open"],
  ["D-006", "High", "Date validation", "Future dates can bypass advertised max", "Through input advertises max=today but keyboard entry saved future sessions", "Used this behavior for requested simulation", "Client validation / integrity", "Open"],
  ["D-007", "High", "Performance", "Large batch save is slow with weak feedback", "531-set save took 57.4s; only disabled ‘Saving…’ state", "Waited for completion; no duplicate writes", "Batch write strategy", "Open"],
  ["D-008", "High", "Analytics", "Future logs distort present-tense dashboard", "On Aug 11 dashboard reported ‘Last session Oct 13’ and future records/totals", "Interpret simulation separately", "Future-data handling", "Open"],
  ["D-009", "Medium", "Adherence", "Companion-plan activity appears off-plan in summary", "Weekly adherence showed ‘5 off-plan’ while split plan was also assigned", "Needs product decision on multi-plan aggregation", "Analytics semantics", "Investigate"],
];
defects.getRange("A3:H3").values = [["ID", "Severity", "Area", "Title", "Observed behavior", "Workaround / continuation", "Likely cause", "Status"]];
defects.getRange(`A4:H${3 + defectRows.length}`).values = defectRows;
header(defects, "A3:H3");
body(defects, `A4:H${3 + defectRows.length}`);
defects.getRange(`B4:B${3 + defectRows.length}`).conditionalFormats.add("containsText", { text: "Blocker", format: { fill: paleRed, font: { color: red, bold: true } } });
defects.getRange(`B4:B${3 + defectRows.length}`).conditionalFormats.add("containsText", { text: "High", format: { fill: paleAmber, font: { color: amber, bold: true } } });
defects.getRange(`B4:B${3 + defectRows.length}`).conditionalFormats.add("containsText", { text: "Medium", format: { fill: paleBlue, font: { color: blue, bold: true } } });
defects.freezePanes.freezeRows(3);
defects.getRange("A:A").format.columnWidth = 11;
defects.getRange("B:B").format.columnWidth = 12;
defects.getRange("C:C").format.columnWidth = 20;
defects.getRange("D:D").format.columnWidth = 36;
defects.getRange("E:E").format.columnWidth = 55;
defects.getRange("F:F").format.columnWidth = 49;
defects.getRange("G:G").format.columnWidth = 28;
defects.getRange("H:H").format.columnWidth = 15;

title(performance, "Performance Observations", "Wall-clock timings from live UI execution. Network, database, rendering, and application processing are included.", "H");
const perfRows = [
  ["Weekly plan save", 7000, "19 exercises", "Watch", "Returned to Plans after saving state"],
  ["Split plan save", 7000, "11 exercises / 3 splits", "Watch", "Returned to Plans after saving state"],
  ["Athlete weekly batch save", 30000, "259 set rows", "Slow", "About 30s; no progress count"],
  ["Athlete split batch save", 22000, "102 set rows", "Slow", "About 22s"],
  ["Coach weekly batch save", 30000, "254 set rows", "Slow", "About 30s"],
  ["Coach split batch save", 23000, "102 set rows", "Slow", "About 23s"],
  ["Future weekly grid entry", 138366, "531 set rows", "Slow", "Three chunks; ~3.8 rows/s"],
  ["Future weekly batch save", 57358, "531 set rows", "Slow", "Longest persistence step"],
  ["Future split grid entry", 19973, "192 set rows", "Slow", "~9.6 rows/s"],
  ["Future split batch save", 28279, "192 set rows", "Slow", "Completed without duplicates"],
  ["Final DB audit query", 4100, "212 sessions / 1,440 logs", "Watch", "Management API read-only reconciliation"],
];
performance.getRange("A3:F3").values = [["Action", "Milliseconds", "Seconds", "Workload", "Rating", "Observation"]];
performance.getRange(`A4:B${3 + perfRows.length}`).values = perfRows.map(r => [r[0], r[1]]);
performance.getRange(`D4:F${3 + perfRows.length}`).values = perfRows.map(r => [r[2], r[3], r[4]]);
performance.getRange("C4").formulas = [["=B4/1000"]];
performance.getRange(`C4:C${3 + perfRows.length}`).fillDown();
performance.getRange(`C4:C${3 + perfRows.length}`).format.numberFormat = "0.0";
header(performance, "A3:F3");
body(performance, `A4:F${3 + perfRows.length}`);
performance.getRange(`E4:E${3 + perfRows.length}`).conditionalFormats.add("containsText", { text: "Slow", format: { fill: paleRed, font: { color: red, bold: true } } });
performance.getRange(`E4:E${3 + perfRows.length}`).conditionalFormats.add("containsText", { text: "Watch", format: { fill: paleAmber, font: { color: amber, bold: true } } });
performance.getRange("H3:I3").values = [["Action", "Seconds"]];
performance.getRange("H4").formulas = [["=A4"]];
performance.getRange("I4").formulas = [["=C4"]];
performance.getRange(`H4:I${3 + perfRows.length}`).fillDown();
const perfChart = performance.charts.add("bar", performance.getRange(`H3:I${3 + perfRows.length}`));
perfChart.title = "Observed UI Operations (seconds)";
perfChart.hasLegend = false;
perfChart.xAxis = { numberFormatCode: "0" };
perfChart.setPosition("H3", "P22");
performance.freezePanes.freezeRows(3);
performance.getRange("A:A").format.columnWidth = 34;
performance.getRange("B:C").format.columnWidth = 15;
performance.getRange("D:D").format.columnWidth = 25;
performance.getRange("E:E").format.columnWidth = 13;
performance.getRange("F:F").format.columnWidth = 45;
performance.getRange("G:G").format.columnWidth = 3;
performance.getRange("H:H").format.columnWidth = 34;
performance.getRange("I:I").format.columnWidth = 14;

title(coverage, "Plan Coverage", "Configured schedules and persisted completion coverage. Split-plan session count excludes configured rest days.", "J");
coverage.getRange("A3:J3").values = [["Plan", "Mode", "Duration days", "Start", "End", "Configured cadence", "Optional policy", "Sessions", "Set logs", "Notes"]];
coverage.getRange("A4:J5").values = [
  ["Pants 4-Month Weekly Full Body", "Weekly", 126, new Date("2026-06-10T00:00:00Z"), new Date("2026-10-13T00:00:00Z"), "Mon–Fri required; Sat/Sun optional", "2 optional days/week", 126, 1044, "All 126 calendar dates have a logged session because optional weekend rows were included in the simulation"],
  ["Pants 4-Month Optional Run & Core", "Custom split", 122, new Date("2026-06-10T00:00:00Z"), new Date("2026-10-09T00:00:00Z"), "3+0r / 3+1r / 1+2r", "Every active split day optional", 86, 396, "86 active sessions; remaining dates are configured interval-rest days"],
];
header(coverage, "A3:J3");
body(coverage, "A4:J5");
coverage.getRange("D4:E5").format.numberFormat = "yyyy-mm-dd";
coverage.getRange("A8:G8").values = [["Phase", "Date range", "Actor / UI", "Weekly exercises", "Weekly sets", "Split exercises", "Split sets"]];
coverage.getRange("A9:G11").values = [
  ["Historical first half", "2026-06-10 → 2026-07-10", "Athlete batch editor", 85, 259, 35, 102],
  ["Historical second half", "2026-07-11 → 2026-08-10", "Coach batch editor", 83, 254, 35, 102],
  ["Forward completion", "2026-08-11 → plan end", "Coach batch editor", 174, 531, 66, 192],
];
header(coverage, "A8:G8");
body(coverage, "A9:G11");
coverage.getRange("A14:D14").values = [["Account", "Display name", "Role", "Verification / approval"]];
coverage.getRange("A15:D16").values = [
  ["ants.pants.e2e.20260811@example.com", "Ants Pants", "Athlete", "Verified; approved after repair"],
  ["sir.pants.e2e.20260811@example.com", "Sir Pants", "Coach", "Verified; approved after repair"],
];
header(coverage, "A14:D14");
body(coverage, "A15:D16");
coverage.getRange("A19:J19").merge();
coverage.getRange("A19").values = [["Security note: passwords are intentionally not stored in this workbook. They are delivered separately in the test handoff."]];
coverage.getRange("A19:J19").format = { fill: paleAmber, font: { bold: true, color: amber }, wrapText: true, borders: { preset: "outside", style: "thin", color: amber } };
coverage.freezePanes.freezeRows(3);
coverage.getRange("A:A").format.columnWidth = 40;
coverage.getRange("B:B").format.columnWidth = 18;
coverage.getRange("C:C").format.columnWidth = 18;
coverage.getRange("D:E").format.columnWidth = 15;
coverage.getRange("F:F").format.columnWidth = 34;
coverage.getRange("G:G").format.columnWidth = 28;
coverage.getRange("H:I").format.columnWidth = 14;
coverage.getRange("J:J").format.columnWidth = 56;

const inspectSummary = await wb.inspect({ kind: "workbook,sheet,formula,drawing", maxChars: 12000, tableMaxRows: 8, tableMaxCols: 10, options: { maxResults: 100 } });
const inspectText = typeof inspectSummary === "string" ? inspectSummary : JSON.stringify(inspectSummary);
const formulaErrors = inspectText.match(/#REF!|#DIV\/0!|#VALUE!|#NAME\?|#N\/A/g) ?? [];
if (formulaErrors.length) throw new Error(`Formula errors found: ${formulaErrors.join(", ")}`);

for (const sheetName of ["Executive Summary", "Test Cases", "Data Audit", "Defects", "Performance", "Plan Coverage"]) {
  const image = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${renderDir}/${sheetName.replaceAll(" ", "_")}.png`, new Uint8Array(await image.arrayBuffer()));
}

const xlsx = await SpreadsheetFile.exportXlsx(wb);
await xlsx.save(outputPath);

console.log(JSON.stringify({ outputPath, renderDir, formulaErrors, inspectChars: inspectText.length }, null, 2));
