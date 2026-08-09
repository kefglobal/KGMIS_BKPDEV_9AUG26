function KMIS_Run_ID_Integrity_Audit() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterName = "KEFG_MASTER_DATABASE_v1.0";
  const auditName = "KMIS_ID_INTEGRITY_AUDIT";

  const master = ss.getSheetByName(masterName);
  if (!master) throw new Error("Master sheet not found.");

  let audit = ss.getSheetByName(auditName);
  if (audit) audit.clear();
  else audit = ss.insertSheet(auditName);

  const lastRow = master.getLastRow();
  const lastCol = master.getLastColumn();

  const headers = master.getRange(1,1,1,lastCol).getDisplayValues()[0];

  function col(name){
    const i = headers.indexOf(name);
    if(i==-1) throw new Error("Header not found : "+name);
    return i;
  }

  const C={
    KEFG_ID:col("KEFG_ID"),
    FAMILY_ID:col("FAMILY_ID"),
    RELATED:col("RELATED_MEMBER_KEFG_ID")
  };

  const data = lastRow>1
    ? master.getRange(2,1,lastRow-1,lastCol).getDisplayValues()
    : [];

  const idMap={};
  const idCount={};

  let blankKEFG=0;
  let blankFamily=0;
  let brokenRelated=0;
  let selfReference=0;
  let oneWay=0;
  let familyMismatch=0;

  data.forEach(r=>{

    const id=String(r[C.KEFG_ID]).trim();

    if(id===""){
      blankKEFG++;
      return;
    }

    idMap[id]=r;

    idCount[id]=(idCount[id]||0)+1;

    if(String(r[C.FAMILY_ID]).trim()==="")
      blankFamily++;

  });

  let duplicateKEFG=0;

  Object.keys(idCount).forEach(id=>{
    if(idCount[id]>1)
      duplicateKEFG+=idCount[id];
  });

  data.forEach(r=>{

    const id=String(r[C.KEFG_ID]).trim();
    const rel=String(r[C.RELATED]).trim();

    if(rel==="") return;

    if(rel===id){
      selfReference++;
      return;
    }

    const other=idMap[rel];

    if(!other){
      brokenRelated++;
      return;
    }

    const otherRel=String(other[C.RELATED]).trim();

    if(otherRel!==id){
      oneWay++;
    }

    const fam1=String(r[C.FAMILY_ID]).trim();
    const fam2=String(other[C.FAMILY_ID]).trim();

    if(fam1!=="" && fam2!=="" && fam1!==fam2){
      familyMismatch++;
    }

  });

  const status=
      duplicateKEFG===0 &&
      blankKEFG===0 &&
      blankFamily===0 &&
      brokenRelated===0 &&
      selfReference===0 &&
      oneWay===0 &&
      familyMismatch===0
      ? "PASS"
      : "FAIL";

  const output=[
    ["KMIS ID INTEGRITY AUDIT",""],
    ["Generated On",new Date()],
    ["Master Database",masterName],
    ["Records Checked",data.length],
    ["",""],
    ["CHECK","COUNT"],
    ["Duplicate KEFG_ID",duplicateKEFG],
    ["Blank KEFG_ID",blankKEFG],
    ["Blank FAMILY_ID",blankFamily],
    ["Broken RELATED_MEMBER_KEFG_ID",brokenRelated],
    ["Self Reference",selfReference],
    ["One-way Relationships",oneWay],
    ["Family ID Mismatch",familyMismatch],
    ["",""],
    ["OVERALL STATUS",status]
  ];

  audit.getRange(1,1,output.length,2).setValues(output);
  audit.autoResizeColumns(1,2);

  SpreadsheetApp.getUi().alert(
      "KMIS ID Integrity Audit Completed\n\n"+
      "Overall Status : "+status
  );

}