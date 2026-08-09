/******************************************************************************
 *
 * KEFG Membership Information System (KMIS)
 *
 * Module        : Family Profile Form Generator
 * File          : 41_Profile_Form.gs
 * Version       : 2.0
 * Status        : Development
 *
 * Purpose:
 * - Automatically create the KEFG Family Profile Update Google Form
 * - Add all approved member-facing fields
 * - Link responses to the Development spreadsheet
 * - Store Form IDs and KMIS field-to-item mappings
 * - Keep internal KMIS identifiers out of the visible form
 *
 ******************************************************************************/

const KMIS_PF_CONFIG = Object.freeze({

  FORM_TITLE:
    'KEFG Family Profile Update',

  FORM_DESCRIPTION:
    'Welcome to the KEFG Family Profile Update.\n\n' +
    'Your family profile has been prepared using the information currently ' +
    'available in the KEFG Membership Information System (KMIS).\n\n' +
    'Please review each section carefully and update any information that ' +
    'has changed. If the information is already correct, simply retain the ' +
    'existing answers and submit the form.\n\n' +
    'Estimated completion time: 5–8 minutes.\n\n' +
    'Your information will be used only for authorised KEFG activities.',

  CONFIRMATION_MESSAGE:
    'Thank you. Your KEFG Family Profile Update has been received. ' +
    'The submitted information will be reviewed before being incorporated ' +
    'into the KMIS database.',

  PROPERTY_KEYS: Object.freeze({
    FORM_ID:
      'KMIS_FAMILY_PROFILE_FORM_ID',

    EDIT_URL:
      'KMIS_FAMILY_PROFILE_FORM_EDIT_URL',

    PUBLISHED_URL:
      'KMIS_FAMILY_PROFILE_FORM_PUBLISHED_URL',

    ITEM_MAP:
      'KMIS_FAMILY_PROFILE_FORM_ITEM_MAP'
  }),

  ALUMNI_ASSOCIATIONS: Object.freeze([
    'CET',
    'KEA',
    'MACE',
    'NIT',
    'NSS',
    'TEC',
    'TKMCE',
    'AECK',
    'OTHER'
  ]),

  GENDER_OPTIONS: Object.freeze([
    'MALE',
    'FEMALE',
    'PREFER NOT TO SAY'
  ]),

  BLOOD_GROUP_OPTIONS: Object.freeze([
    'A+',
    'A-',
    'B+',
    'B-',
    'AB+',
    'AB-',
    'O+',
    'O-',
    'NOT KNOWN'
  ]),

  YES_NO_OPTIONS: Object.freeze([
    'YES',
    'NO'
  ]),

  YES_NO_UNSURE_OPTIONS: Object.freeze([
    'YES',
    'NO',
    'NOT SURE'
  ]),

  VOLUNTEER_OPTIONS: Object.freeze([
    'YES',
    'NO',
    'MAYBE',
    'PLEASE CONTACT ME'
  ]),

  PREFERRED_CONTACT_OPTIONS: Object.freeze([
    'PRIMARY MEMBER',
    'SPOUSE',
    'EITHER',
    'BOTH'
  ]),

  WILLING_TO_JOIN_OPTIONS: Object.freeze([
    'YES',
    'NO',
    'ALREADY A MEMBER',
    'PLEASE CONTACT ME'
  ])
});


/**
 * Creates the Family Profile Form.
 *
 * The function refuses to create a duplicate if a Form ID is already stored.
 */
function KMIS_PF_CreateForm() {
  KMIS_RequireApplicationAdminAccess_();

  const properties =
    PropertiesService.getScriptProperties();

  const existingFormId =
    properties.getProperty(
      KMIS_PF_CONFIG.PROPERTY_KEYS.FORM_ID
    );

  if (existingFormId) {
    throw new Error(
      'A KEFG Family Profile Form is already registered for this project. ' +
      'Run KMIS_PF_GetFormDetails to view it, or run ' +
      'KMIS_PF_CreateNewFormVersion to create a new version.'
    );
  }

  return KMIS_PF_CreateFormInternal_();
}


/**
 * Creates a new Form version even when an earlier Form exists.
 *
 * The old Form is not deleted.
 */
function KMIS_PF_CreateNewFormVersion() {
  KMIS_RequireApplicationAdminAccess_();

  return KMIS_PF_CreateFormInternal_();
}


/**
 * Internal Form creation service.
 */
function KMIS_PF_CreateFormInternal_() {
  const spreadsheet =
    KMIS_DB_GetSpreadsheet();

  const form =
    FormApp.create(
      KMIS_PF_CONFIG.FORM_TITLE
    );

  form
    .setDescription(
      KMIS_PF_CONFIG.FORM_DESCRIPTION
    )
    .setConfirmationMessage(
      KMIS_PF_CONFIG.CONFIRMATION_MESSAGE
    )
    .setProgressBar(true)
    .setShuffleQuestions(false)
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setAcceptingResponses(true);

  /*
   * Responses are stored in the current Development spreadsheet.
   */
  form.setDestination(
    FormApp.DestinationType.SPREADSHEET,
    spreadsheet.getId()
  );

  const itemMap = {};

  KMIS_PF_AddWelcomeSection_(
    form,
    itemMap
  );

  KMIS_PF_AddPrimaryMemberSections_(
    form,
    itemMap
  );

  KMIS_PF_AddSpouseSections_(
    form,
    itemMap
  );

  KMIS_PF_AddFamilySection_(
    form,
    itemMap
  );

  KMIS_PF_AddCommunicationSection_(
    form,
    itemMap
  );

  KMIS_PF_AddConsentSection_(
    form,
    itemMap
  );

  const properties =
    PropertiesService.getScriptProperties();

  properties.setProperties({
    [KMIS_PF_CONFIG.PROPERTY_KEYS.FORM_ID]:
      form.getId(),

    [KMIS_PF_CONFIG.PROPERTY_KEYS.EDIT_URL]:
      form.getEditUrl(),

    [KMIS_PF_CONFIG.PROPERTY_KEYS.PUBLISHED_URL]:
      form.getPublishedUrl(),

    [KMIS_PF_CONFIG.PROPERTY_KEYS.ITEM_MAP]:
      JSON.stringify(itemMap)
  });

  const result = {
    success: true,

    message:
      'KEFG Family Profile Update Form created successfully.',

    formId:
      form.getId(),

    editUrl:
      form.getEditUrl(),

    publishedUrl:
      form.getPublishedUrl(),

    responseSpreadsheetId:
      spreadsheet.getId(),

    mappedFieldCount:
      Object.keys(itemMap).length,

    manualActionsRequired: [
      'Add the KEFG header image through Customize theme.',
      'Choose the KEFG theme colour and font.',
      'Add a File upload question for FAMILY_PHOTO in the Family Details section.'
    ]
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


/**
 * Adds the first page and general instructions.
 */
function KMIS_PF_AddWelcomeSection_(
  form,
  itemMap
) {
  form
    .addSectionHeaderItem()
    .setTitle(
      'Welcome to the KEFG Family Profile Update'
    )
    .setHelpText(
      'Please review the information already available in KMIS. ' +
      'Update only details that have changed. Existing information will ' +
      'later be inserted through personalised pre-filled links.'
    );

  form
    .addSectionHeaderItem()
    .setTitle(
      'Important Instructions'
    )
    .setHelpText(
      '• Review both Primary Member and Spouse information.\n' +
      '• Do not re-enter information unnecessarily.\n' +
      '• Subscription status is maintained by the Treasurer.\n' +
      '• Upload a new couple photo only when replacing the existing photo.\n' +
      '• Internal KMIS identifiers are not displayed in this form.'
    );
}


/**
 * Adds all Primary Member sections.
 */
function KMIS_PF_AddPrimaryMemberSections_(
  form,
  itemMap
) {
  form
    .addPageBreakItem()
    .setTitle(
      'Primary Member — Personal Information'
    )
    .setHelpText(
      'Please review the Primary Member’s personal information.'
    );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'MEMBER_NAME',
    'Full Name',
    true
  );

  KMIS_PF_AddListItem_(
    form,
    itemMap,
    'GENDER',
    'Gender',
    KMIS_PF_CONFIG.GENDER_OPTIONS,
    true
  );

  KMIS_PF_AddListItem_(
    form,
    itemMap,
    'BLOOD_GROUP',
    'Blood Group',
    KMIS_PF_CONFIG.BLOOD_GROUP_OPTIONS,
    false
  );

  KMIS_PF_AddDateItem_(
    form,
    itemMap,
    'MEMBER_DOB_FULL',
    'Date of Birth',
    false
  );


  form
    .addPageBreakItem()
    .setTitle(
      'Primary Member — Alumni Information'
    )
    .setHelpText(
      'Please review the alumni association, branch and batch/year.'
    );

  KMIS_PF_AddListItem_(
    form,
    itemMap,
    'ALUMNI_ASSOCIATION',
    'Alumni Association',
    KMIS_PF_CONFIG.ALUMNI_ASSOCIATIONS,
    true
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'BRANCH',
    'Branch',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'YEAR_BATCH',
    'Batch / Year',
    false
  );


  form
    .addPageBreakItem()
    .setTitle(
      'Primary Member — Contact Information'
    );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'MEMBER_MOBILE',
    'Mobile Number',
    true,
    'Please include the country code.'
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'MEMBER_WHATSAPP',
    'WhatsApp Number',
    true,
    'Please include the country code.'
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'MEMBER_EMAIL',
    'Email Address',
    false
  );

  KMIS_PF_AddMultipleChoiceItem_(
    form,
    itemMap,
    'WHATSAPP_GROUP_MEMBER',
    'Are you a member of a KEFG WhatsApp Group?',
    KMIS_PF_CONFIG.YES_NO_UNSURE_OPTIONS,
    true
  );


  form
    .addPageBreakItem()
    .setTitle(
      'Primary Member — Current Location'
    );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'CURRENT_LOCATION_COUNTRY',
    'Country of Residence',
    true
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'CURRENT_LOCATION_STATE',
    'State / Province / Emirate',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'CURRENT_LOCATION_CITY_DISTRICT',
    'City / District',
    true
  );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'LATEST_ADDRESS',
    'Current Postal Address',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'HOME_LOCATION_GOOGLE_MAP',
    'Home Location Google Maps Link',
    false
  );


  form
    .addPageBreakItem()
    .setTitle(
      'Primary Member — Profession and KEFG'
    );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'MEMBER_PRESENT_ACTIVITIES',
    'Present Activities',
    false
  );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'MEMBER_PROFESSION_SKILLS',
    'Profession, Qualifications and Skills',
    false
  );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'KEF_KEFGLOBAL_CONTRIBUTIONS',
    'Contributions to KEF / KEFG Global',
    false
  );

  KMIS_PF_AddMultipleChoiceItem_(
    form,
    itemMap,
    'MEMBER_WILLING_TO_VOLUNTEER',
    'Would you be willing to volunteer?',
    KMIS_PF_CONFIG.VOLUNTEER_OPTIONS,
    true
  );
}


/**
 * Adds spouse decision and spouse details with branching.
 */
function KMIS_PF_AddSpouseSections_(
  form,
  itemMap
) {
  const spouseDecisionPage =
    form
      .addPageBreakItem()
      .setTitle(
        'Spouse Information'
      )
      .setHelpText(
        'Existing spouse information will be pre-filled where available.'
      );

  const spouseDecision =
    form
      .addMultipleChoiceItem()
      .setTitle(
        'Would you like to add or update your spouse’s details in your KEFG Family Profile?'
      )
      .setRequired(true);

  KMIS_PF_RegisterItem_(
    itemMap,
    'SPOUSE_SECTION_DECISION',
    spouseDecision
  );

  const spouseDetailsPage =
    form
      .addPageBreakItem()
      .setTitle(
        'Spouse — Personal and Contact Information'
      );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'SPOUSE_NAME',
    'Spouse Full Name',
    true
  );

  KMIS_PF_AddListItem_(
    form,
    itemMap,
    'SPOUSE_GENDER',
    'Spouse Gender',
    KMIS_PF_CONFIG.GENDER_OPTIONS,
    true
  );

  KMIS_PF_AddDateItem_(
    form,
    itemMap,
    'SPOUSE_DOB_FULL',
    'Spouse Date of Birth',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'SPOUSE_MOBILE',
    'Spouse Mobile Number',
    false,
    'Please include the country code.'
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'SPOUSE_WHATSAPP',
    'Spouse WhatsApp Number',
    false,
    'Please include the country code.'
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'SPOUSE_EMAIL',
    'Spouse Email Address',
    false
  );


  form
    .addPageBreakItem()
    .setTitle(
      'Spouse — Alumni Information'
    )
    .setHelpText(
      'Complete the association, branch and batch/year when applicable.'
    );

  KMIS_PF_AddListItem_(
    form,
    itemMap,
    'SPOUSE_ALUMNI_ASSOCIATION',
    'Spouse Alumni Association',
    KMIS_PF_CONFIG.ALUMNI_ASSOCIATIONS,
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'SPOUSE_BRANCH',
    'Spouse Branch',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'SPOUSE_BATCH_YEAR',
    'Spouse Batch / Year',
    false
  );


  form
    .addPageBreakItem()
    .setTitle(
      'Spouse — Location, Profession and KEFG'
    );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'SPOUSE_CURRENT_CITY_DISTRICT',
    'Spouse Current City / District',
    false
  );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'SPOUSE_ACTIVITIES',
    'Spouse Present Activities',
    false
  );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'SPOUSE_PROFESSION_SKILLS',
    'Spouse Profession, Qualifications and Skills',
    false
  );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'SPOUSE_KEF_KEFGLOBAL_CONTRIBUTIONS',
    'Spouse Contributions to KEF / KEFG Global',
    false
  );

  KMIS_PF_AddMultipleChoiceItem_(
    form,
    itemMap,
    'SPOUSE_WILLING_TO_VOLUNTEER',
    'Would your spouse be willing to volunteer?',
    KMIS_PF_CONFIG.VOLUNTEER_OPTIONS,
    false
  );


  const familyPage =
    form
      .addPageBreakItem()
      .setTitle(
        'Family Details'
      );

  spouseDecision.setChoices([
    spouseDecision.createChoice(
      'YES',
      spouseDetailsPage
    ),

    spouseDecision.createChoice(
      'NO',
      familyPage
    )
  ]);

  /*
   * spouseDecisionPage is retained to make the intended section structure
   * explicit and easier to inspect during development.
   */
  void spouseDecisionPage;

  KMIS_PF_AddFamilyQuestions_(
    form,
    itemMap
  );
}


/**
 * Family questions are added after the branching target page.
 */
function KMIS_PF_AddFamilyQuestions_(
  form,
  itemMap
) {
  form
    .addSectionHeaderItem()
    .setTitle(
      'Couple Photo'
    )
    .setHelpText(
      'Please upload a recent photograph of the Primary Member and Spouse ' +
      'together only if you wish to add or replace the existing photo.\n\n' +
      'The File upload question must be added manually after the Form is created.'
    );

  KMIS_PF_AddDateItem_(
    form,
    itemMap,
    'WEDDING_DATE_FULL',
    'Wedding Date',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'CHILD_1_NAME_AND_PROFESSION',
    'Child 1 — Name and Profession / Course',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'CHILD_2_NAME_AND_PROFESSION',
    'Child 2 — Name and Profession / Course',
    false
  );

  KMIS_PF_AddTextItem_(
    form,
    itemMap,
    'CHILD_3_NAME_AND_PROFESSION',
    'Child 3 — Name and Profession / Course',
    false
  );
}


/**
 * Kept for architectural clarity.
 * Family questions are currently added inside the spouse branching builder.
 */
function KMIS_PF_AddFamilySection_(
  form,
  itemMap
) {
  void form;
  void itemMap;
}


/**
 * Adds communication and Treasurer-controlled information.
 */
function KMIS_PF_AddCommunicationSection_(
  form,
  itemMap
) {
  form
    .addPageBreakItem()
    .setTitle(
      'Communication Preferences'
    );

  KMIS_PF_AddListItem_(
    form,
    itemMap,
    'PREFERRED_FAMILY_CONTACT',
    'Preferred Family Contact',
    KMIS_PF_CONFIG.PREFERRED_CONTACT_OPTIONS,
    true
  );

  KMIS_PF_AddMultipleChoiceItem_(
    form,
    itemMap,
    'WILLING_TO_JOIN',
    'Willing to Join KEFG?',
    KMIS_PF_CONFIG.WILLING_TO_JOIN_OPTIONS,
    true
  );

  form
    .addSectionHeaderItem()
    .setTitle(
      'Subscription Status 2026–27'
    )
    .setHelpText(
      'The subscription status will be displayed through the personalised ' +
      'family link. It is maintained exclusively by the Treasurer. ' +
      'Please report any discrepancy in the Remarks field.'
    );

  KMIS_PF_AddParagraphItem_(
    form,
    itemMap,
    'REMARKS',
    'Additional Information or Corrections',
    false,
    'You may also report any subscription-status discrepancy here.'
  );
}


/**
 * Adds consent and final declaration.
 */
function KMIS_PF_AddConsentSection_(
  form,
  itemMap
) {
  form
    .addPageBreakItem()
    .setTitle(
      'Consent and Declaration'
    );

  const consent =
    form
      .addCheckboxItem()
      .setTitle(
        'Data Consent'
      )
      .setHelpText(
        'I consent to KEFG retaining and using the information provided ' +
        'for membership administration, communication, member-directory ' +
        'functions and authorised KEFG activities.'
      )
      .setRequired(true);

  consent.setChoices([
    consent.createChoice(
      'I GIVE MY CONSENT'
    )
  ]);

  KMIS_PF_RegisterItem_(
    itemMap,
    'DATA_CONSENT',
    consent
  );

  const declaration =
    form
      .addCheckboxItem()
      .setTitle(
        'Final Declaration'
      )
      .setHelpText(
        'I confirm that I have reviewed the information submitted and that ' +
        'it is accurate to the best of my knowledge.'
      )
      .setRequired(true);

  declaration.setChoices([
    declaration.createChoice(
      'I CONFIRM AND SUBMIT THIS KEFG FAMILY PROFILE UPDATE'
    )
  ]);

  KMIS_PF_RegisterItem_(
    itemMap,
    'FORM_DECLARATION',
    declaration
  );
}


/**
 * Helper: adds a short-text question.
 */
function KMIS_PF_AddTextItem_(
  form,
  itemMap,
  kmisHeader,
  label,
  required,
  helpText
) {
  const item =
    form
      .addTextItem()
      .setTitle(label)
      .setRequired(Boolean(required));

  if (helpText) {
    item.setHelpText(helpText);
  }

  KMIS_PF_RegisterItem_(
    itemMap,
    kmisHeader,
    item
  );

  return item;
}


/**
 * Helper: adds a paragraph question.
 */
function KMIS_PF_AddParagraphItem_(
  form,
  itemMap,
  kmisHeader,
  label,
  required,
  helpText
) {
  const item =
    form
      .addParagraphTextItem()
      .setTitle(label)
      .setRequired(Boolean(required));

  if (helpText) {
    item.setHelpText(helpText);
  }

  KMIS_PF_RegisterItem_(
    itemMap,
    kmisHeader,
    item
  );

  return item;
}


/**
 * Helper: adds a date question.
 */
function KMIS_PF_AddDateItem_(
  form,
  itemMap,
  kmisHeader,
  label,
  required
) {
  const item =
    form
      .addDateItem()
      .setTitle(label)
      .setIncludesYear(true)
      .setRequired(Boolean(required));

  KMIS_PF_RegisterItem_(
    itemMap,
    kmisHeader,
    item
  );

  return item;
}


/**
 * Helper: adds a dropdown question.
 */
function KMIS_PF_AddListItem_(
  form,
  itemMap,
  kmisHeader,
  label,
  choices,
  required
) {
  const item =
    form
      .addListItem()
      .setTitle(label)
      .setChoiceValues([...choices])
      .setRequired(Boolean(required));

  KMIS_PF_RegisterItem_(
    itemMap,
    kmisHeader,
    item
  );

  return item;
}


/**
 * Helper: adds a multiple-choice question.
 */
function KMIS_PF_AddMultipleChoiceItem_(
  form,
  itemMap,
  kmisHeader,
  label,
  choices,
  required
) {
  const item =
    form
      .addMultipleChoiceItem()
      .setTitle(label)
      .setChoiceValues([...choices])
      .setRequired(Boolean(required));

  KMIS_PF_RegisterItem_(
    itemMap,
    kmisHeader,
    item
  );

  return item;
}


/**
 * Stores the exact Form item ID for each KMIS header.
 *
 * Response processing will use item IDs, not visible question labels.
 */
function KMIS_PF_RegisterItem_(
  itemMap,
  kmisHeader,
  item
) {
  itemMap[kmisHeader] = {
    itemId:
      item.getId(),

    itemType:
      String(item.getType()),

    title:
      item.getTitle()
  };
}


/**
 * Returns the current registered Form details.
 */
function KMIS_PF_GetFormDetails() {
  KMIS_RequireApplicationAdminAccess_();

  const properties =
    PropertiesService.getScriptProperties();

  const formId =
    properties.getProperty(
      KMIS_PF_CONFIG.PROPERTY_KEYS.FORM_ID
    );

  if (!formId) {
    return {
      success: false,
      message:
        'No KEFG Family Profile Form is currently registered.'
    };
  }

  const form =
    FormApp.openById(formId);

  return {
    success: true,

    formId:
      form.getId(),

    title:
      form.getTitle(),

    editUrl:
      form.getEditUrl(),

    publishedUrl:
      form.getPublishedUrl(),

    acceptingResponses:
      form.isAcceptingResponses(),

    itemCount:
      form.getItems().length,

    responseDestinationId:
      form.getDestinationId()
  };
}


/**
 * Returns the stored KMIS-field-to-Form-item map.
 */
function KMIS_PF_GetItemMap() {
  KMIS_RequireApplicationAdminAccess_();

  const json =
    PropertiesService
      .getScriptProperties()
      .getProperty(
        KMIS_PF_CONFIG.PROPERTY_KEYS.ITEM_MAP
      );

  return json
    ? JSON.parse(json)
    : {};
}


/**
 * Safe test of the stored Form registration.
 */
function KMIS_PF_TestFormDetails() {
  const result =
    KMIS_PF_GetFormDetails();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}