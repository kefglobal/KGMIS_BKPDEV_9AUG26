/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Module
 *
 * File:
 * 30.01_KGMIS_Treasurer_Module.gs
 * ============================================================
 *
 * Purpose
 * -------
 * Module configuration
 * Portal entry point
 * Access-denied page
 *
 * Business logic is intentionally kept in separate files.
 */


/**
 * ============================================================
 * Treasurer Module Configuration
 * ============================================================
 */

const KGMIS_TREASURER_CONFIG = Object.freeze({

  MODULE_NAME:
    KGMIS_SECURITY_CONFIG.MODULES.TREASURER,

  MODULE_TITLE:
    "KGMIS Treasurer Portal",

  SYSTEM_NAME:
    "KEF Global Membership Information System",

  VIEW_ACTION:
    KGMIS_SECURITY_CONFIG.ACTIONS.VIEW,

  UPDATE_ACTION:
    KGMIS_SECURITY_CONFIG.ACTIONS.UPDATE

});


/**
 * ============================================================
 * Treasurer Portal Entry
 * ============================================================
 */

function KGMIS_Treasurer_DoGet_Legacy_(e) {

  try {

    const user =
      KGMIS_RequireModuleAccess_(

        KGMIS_TREASURER_CONFIG.MODULE_NAME,

        KGMIS_TREASURER_CONFIG.VIEW_ACTION

      );

 const template =
  HtmlService.createTemplateFromFile(
  "KGMIS_Treasurer_Portal"
);
template.currentUser =
  user;

template.portalConfig = {
  moduleName:
    KGMIS_TREASURER_CONFIG.MODULE_NAME,

  moduleTitle:
    KGMIS_TREASURER_CONFIG.MODULE_TITLE,

  systemName:
    KGMIS_TREASURER_CONFIG.SYSTEM_NAME
};

return template
  .evaluate()
  .setTitle(
    KGMIS_TREASURER_CONFIG.MODULE_TITLE
  )
  .addMetaTag(
    "viewport",
    "width=device-width, initial-scale=1"
  );

  }

  catch (error) {

    console.error(error);

    return KGMIS_Treasurer_CreateAccessDeniedPage_(
      error
    );

  }

}


/**
 * ============================================================
 * Access Denied Page
 * ============================================================
 */

function KGMIS_Treasurer_CreateAccessDeniedPage_(error) {

  const message =
    KGMIS_Treasurer_EscapeHtml_(

      String(
        error && error.message
          ? error.message
          : "Access denied."
      )

    );

  return HtmlService
    .createHtmlOutput(

`<!DOCTYPE html>

<html>

<head>

<meta
name="viewport"
content="width=device-width, initial-scale=1">

<style>

body{

margin:0;

background:#f5f6f8;

font-family:Arial,sans-serif;

display:flex;

justify-content:center;

align-items:center;

height:100vh;

}

.card{

width:500px;

background:white;

padding:40px;

border-radius:14px;

box-shadow:0 8px 24px rgba(0,0,0,.15);

text-align:center;

}

h1{

color:#b3261e;

margin-bottom:15px;

}

.info{

line-height:1.7;

color:#455A64;

}

.error{

margin-top:20px;

padding:15px;

background:#f3f3f3;

border-radius:8px;

font-size:13px;

}

.footer{

margin-top:25px;

font-size:12px;

color:#78909C;

}

</style>

</head>

<body>

<div class="card">

<h1>

Access Denied

</h1>

<div class="info">

You are not authorised to access

the Treasurer Module.

</div>

<div class="info">

Please contact the

KGMIS Administrator.

</div>

<div class="error">

${message}

</div>

<div class="footer">

KEF Global Membership Information System

</div>

</div>

</body>

</html>`

)

.setTitle("Access Denied");

}


/**
 * ============================================================
 * HTML Escape Utility
 * ============================================================
 */

function KGMIS_Treasurer_EscapeHtml_(text){

  return String(text)

    .replace(/&/g,"&amp;")

    .replace(/</g,"&lt;")

    .replace(/>/g,"&gt;")

    .replace(/"/g,"&quot;")

    .replace(/'/g,"&#39;");

}