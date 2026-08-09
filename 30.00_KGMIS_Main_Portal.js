/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Main Portal Entry Service
 *
 * File: 30.00_KGMIS_Main_Portal.gs
 * ============================================================
 *
 * Purpose:
 * - Serve KGMIS_Main_Portal.html as the web-app entry page
 * - Allow the OTP login screen to load before authentication
 * - Provide basic Main Portal configuration to the template
 *
 * Important:
 * - This project must contain only ONE doGet(e) function.
 * - The older Treasurer Portal doGet(e) must be renamed or removed.
 * - Authentication is completed after page load through
 *   06.01_KGMIS_OTP_Authentication.gs.
 */


/**
 * ============================================================
 * MAIN PORTAL CONFIGURATION
 * ============================================================
 *
 * Literal values are used here to avoid cross-file global
 * initialization-order problems in Apps Script.
 */
const KGMIS_MAIN_PORTAL_CONFIG = Object.freeze({

  PORTAL_TITLE:
    'KGMIS Main Portal',

  SYSTEM_NAME:
    'KEF Global Membership Information System',

  HTML_FILE:
    'KGMIS_Main_Portal',

  VERSION:
    '1.0',

  SESSION_VALID_MINUTES:
    480
});


/**
 * ============================================================
 * WEB APP ENTRY POINT
 * ============================================================
 *
 * Do not require module access here.
 *
 * The login page must be available before the visitor has an
 * OTP session. Module permissions are checked after login and
 * again inside every protected backend service.
 */
function doGet(e) {


      if (
    e &&
    e.parameter &&
    e.parameter.module ===
      'digital-card-test'
  ) {
    return KGMIS_TestAdminCardPreviewHtml();
  }

  try {

    const parameters =
      e && e.parameter
        ? e.parameter
        : {};

    const moduleName =
      String(
        parameters.module || ''
      )
      .trim()
      .toLowerCase();

    const modeName =
      String(
        parameters.mode || ''
      )
      .trim()
      .toLowerCase();

    // --------------------------------------------------------
    // PUBLIC MEMBERSHIP VERIFICATION
    // --------------------------------------------------------

    if (moduleName === 'verify') {

      return KGMIS_RenderMembershipVerification_(
        e
      );

    }

    // --------------------------------------------------------
    // PRODUCTION DIGITAL CARD MODULE
    // --------------------------------------------------------

    if (moduleName === 'digital-card') {

      return KGMIS_RenderDigitalCardModule_(
        e
      );

    }

    // --------------------------------------------------------
    // FAMILY PROFILE MODULE
    // --------------------------------------------------------

    if (moduleName === 'family-profile') {

      return KGMIS_RenderFamilyProfile_(e);

    }

    // --------------------------------------------------------
    // TEMPORARY DEVELOPMENT TEST ROUTE
    // --------------------------------------------------------

    if (modeName === 'digital-card-test') {

      return KGMIS_TestRenderDigitalCard();

    }

    // --------------------------------------------------------
    // MAIN PORTAL
    // --------------------------------------------------------

    const template =
      HtmlService.createTemplateFromFile(
        KGMIS_MAIN_PORTAL_CONFIG.HTML_FILE
      );

    template.portalConfig = {

      portalTitle:
        KGMIS_MAIN_PORTAL_CONFIG.PORTAL_TITLE,

      systemName:
        KGMIS_MAIN_PORTAL_CONFIG.SYSTEM_NAME,

      version:
        KGMIS_MAIN_PORTAL_CONFIG.VERSION,

      sessionValidMinutes:
        KGMIS_MAIN_PORTAL_CONFIG
          .SESSION_VALID_MINUTES

    };

    return template
      .evaluate()
      .setTitle(
        KGMIS_MAIN_PORTAL_CONFIG.PORTAL_TITLE
      )
      .addMetaTag(
        'viewport',
        'width=device-width, initial-scale=1'
      )
      .setXFrameOptionsMode(
        HtmlService.XFrameOptionsMode.DEFAULT
      );

} catch (error) {

  const errorMessage =
    error && error.message
      ? error.message
      : String(error);

  const errorStack =
    error && error.stack
      ? error.stack
      : 'Stack trace unavailable';

  console.error(
    'KGMIS Web App could not be loaded.\n' +
    'Message: ' + errorMessage + '\n' +
    'Stack: ' + errorStack
  );

  return KGMIS_MainPortal_CreateErrorPage_(
    error
  );

}
}

/**
 * ============================================================
 * FAMILY PROFILE MODULE RENDERER
 * ============================================================
 */
function KGMIS_RenderFamilyProfile_(e) {

  const parameters =
    e && e.parameter
      ? e.parameter
      : {};

  const template =
    HtmlService.createTemplateFromFile(
      'FamilyProfile'
    );

  template.initialToken =
    String(
      parameters.sessionToken ||
      parameters.token ||
      ''
    ).trim();

  return template
    .evaluate()
    .setTitle(
      'KEFG Family Profile'
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.DEFAULT
    );
}

/**
 * Evaluates and includes an HTML template.
 * Supports nested includes such as Main Portal → Treasurer
 * Module → Receive Payment.
 */
function include(fileName) {

  return HtmlService
    .createTemplateFromFile(
      fileName
    )
    .evaluate()
    .getContent();
}


/**
 * ============================================================
 * MAIN PORTAL ERROR PAGE
 * ============================================================
 */
function KGMIS_MainPortal_CreateErrorPage_(
  error
) {

  const message =
    KGMIS_MainPortal_EscapeHtml_(
      String(
        error && error.message
          ? error.message
          : 'The KGMIS Main Portal could not be loaded.'
      )
    );

  return HtmlService
    .createHtmlOutput(
`<!DOCTYPE html>
<html>
<head>
  <base target="_top">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  >

  <title>KGMIS Portal Error</title>

  <style>
    :root {
      --primary-dark: #0d4e70;
      --background: #f3f7fa;
      --panel: #ffffff;
      --border: #d5e0e8;
      --text: #1f2937;
      --muted: #64748b;
      --danger: #b42318;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      min-height: 100%;
    }

    body {
      min-height: 100vh;

      display: grid;
      place-items: center;

      padding: 22px;

      color: var(--text);
      background: var(--background);

      font-family:
        Arial,
        Helvetica,
        sans-serif;
    }

    .error-card {
      width: min(100%, 520px);
      padding: 30px;

      border: 1px solid var(--border);
      border-radius: 16px;

      background: var(--panel);

      box-shadow:
        0 12px 34px rgba(13, 78, 112, 0.12);

      text-align: center;
    }

    .error-icon {
      width: 52px;
      height: 52px;

      display: grid;
      place-items: center;

      margin: 0 auto 14px;

      border-radius: 50%;

      color: #ffffff;
      background: var(--danger);

      font-size: 27px;
      font-weight: 800;
    }

    h1 {
      margin: 0;
      color: var(--primary-dark);
      font-size: 25px;
    }

    p {
      margin: 9px 0 0;
      color: var(--muted);
      line-height: 1.55;
    }

    .error-details {
      margin-top: 18px;
      padding: 13px;

      border: 1px solid #fecdca;
      border-radius: 10px;

      color: var(--danger);
      background: #fef3f2;

      font-size: 13px;
      line-height: 1.45;
      text-align: left;
      overflow-wrap: anywhere;
    }

    .footer {
      margin-top: 18px;
      color: var(--muted);
      font-size: 11px;
    }
  </style>
</head>

<body>
  <main class="error-card">
    <div class="error-icon">
      !
    </div>

    <h1>
      KGMIS Portal Error
    </h1>

    <p>
      The Main Portal could not be opened.
      Please contact the KGMIS Administrator.
    </p>

    <div class="error-details">
      ${message}
    </div>

    <div class="footer">
      KEF Global Membership Information System
    </div>
  </main>
</body>
</html>`
    )
    .setTitle(
      'KGMIS Portal Error'
    );
}

/**
 * ============================================================
 * HTML ESCAPE UTILITY
 * ============================================================
 */
function KGMIS_MainPortal_EscapeHtml_(
  value
) {

  return String(
    value == null
      ? ''
      : value
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#39;'
    );
}


/**
 * ============================================================
 * SAFE MAIN PORTAL TEST
 * ============================================================
 *
 * Confirms that the required HTML files exist and can be read.
 * This function does not send an OTP and does not create a
 * login session.
 */
function KGMIS_TestMainPortalFiles() {

  const requiredFiles = [
    'KGMIS_Main_Portal',
    'KGMIS_Header',
    'KGMIS_OTP_Login',
    'KGMIS_Logo',
    'KGMIS_Module_Directory',
    'KGMIS_Module_Treasurer',
    'KGMIS_Receive_Payment_Embedded'
  ];

  const result = {
    success:
      true,

    files:
      {}
  };

  requiredFiles.forEach(
    function (fileName) {

      try {

        const content =
          HtmlService
            .createHtmlOutputFromFile(
              fileName
            )
            .getContent();

        result.files[fileName] = {
          found:
            true,

          contentLength:
            content.length
        };

      } catch (error) {

        result.success =
          false;

        result.files[fileName] = {
          found:
            false,

          error:
            String(
              error && error.message
                ? error.message
                : error
            )
        };
      }
    }
  );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

