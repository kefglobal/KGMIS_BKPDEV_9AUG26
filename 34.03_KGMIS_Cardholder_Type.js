/**
 * ============================================================
 * CARDHOLDER TYPE RESOLVER
 * ============================================================
 * File : 34.03_KGMIS_Cardholder_Type.gs
 *
 * Converts a Person Object into the official
 * CARDHOLDER_TYPE stored in KEFG_MEMBER_CARDS
 * and displayed on the membership card.
 *
 * OFFICIAL CARDHOLDER TYPES
 * -------------------------
 * PRIMARY MEMBER
 * DEPENDENT = FAMILY MEMBER
 *
 * ============================================================
 */

function KGMIS_GetCardholderType_(person) {

  if (!person) {
    throw new Error(
      "Person object required."
    );
  }

  const source = String(
    person.source || ""
  )
    .trim()
    .toUpperCase();

  //----------------------------------------------------------
  // MEMBER DATABASE
  //----------------------------------------------------------

  if (
    source ===
    KGMIS_CONFIG.SOURCE_TYPE.MEMBER
  ) {

    const category = String(
      person.memberCategory || ""
    )
      .trim()
      .toUpperCase();

    switch (category) {

      case "PRIMARY MEMBER":

      case "ALUMNI SPOUSE":

      case "ALUMNI SPOUSE MEMBER":

        return "PRIMARY MEMBER";

      case "SPOUSE":

      case "NON-ALUMNI SPOUSE":

      case "NON-ALUMNI SPOUSE MEMBER":

        return "MEMBER";

      default:

        throw new Error(
          "Unknown MEMBER_CATEGORY : " +
          person.memberCategory
        );

    }

  }

  //----------------------------------------------------------
  // DEPENDANTS
  //----------------------------------------------------------

  if (
    source ===
    KGMIS_CONFIG.SOURCE_TYPE.DEPENDANT
  ) {

    const dependantType = String(
      person.dependantType || ""
    )
      .trim()
      .toUpperCase();

    switch (dependantType) {

      case "PARENT":

      case "FATHER_IN_LAW":

      case "MOTHER_IN_LAW":

      case "CHILD1":

      case "CHILD2":

      case "CHILD3":

      // Compatibility values
      case "FATHER-IN-LAW":

      case "MOTHER-IN-LAW":

      case "CHILD 1":

      case "CHILD 2":

      case "CHILD 3":

        return "DEPENDENT";

      default:

        throw new Error(
          "Unknown DEPENDANT_TYPE : " +
          person.dependantType
        );

    }

  }

  //----------------------------------------------------------
  // UNKNOWN SOURCE
  //----------------------------------------------------------

  throw new Error(
    "Unknown Person Source : " +
    person.source
  );

}


/**
 * ============================================================
 * SAFE TEST
 * CARDHOLDER TYPE RESOLVER
 * ============================================================
 */

function KGMIS_TestCardholderTypeResolver() {

  const tests = [

    {
      label: "Primary Member",
      person: {
        source:
          KGMIS_CONFIG.SOURCE_TYPE.MEMBER,
        memberCategory:
          "PRIMARY MEMBER"
      },
      expected:
        "PRIMARY MEMBER"
    },

    {
      label: "Alumni Spouse Member",
      person: {
        source:
          KGMIS_CONFIG.SOURCE_TYPE.MEMBER,
        memberCategory:
          "ALUMNI SPOUSE MEMBER"
      },
      expected:
        "PRIMARY MEMBER"
    },

    {
      label: "Non-Alumni Spouse Member",
      person: {
        source:
          KGMIS_CONFIG.SOURCE_TYPE.MEMBER,
        memberCategory:
          "NON-ALUMNI SPOUSE MEMBER"
      },
      expected:
        "MEMBER"
    },

    {
      label: "Parent",
      person: {
        source:
          KGMIS_CONFIG.SOURCE_TYPE.DEPENDANT,
        dependantType:
          "PARENT"
      },
      expected:
        "DEPENDENT"
    },

    {
      label: "Father-in-law",
      person: {
        source:
          KGMIS_CONFIG.SOURCE_TYPE.DEPENDANT,
        dependantType:
          "FATHER_IN_LAW"
      },
      expected:
        "DEPENDENT"
    },

    {
      label: "Child 1",
      person: {
        source:
          KGMIS_CONFIG.SOURCE_TYPE.DEPENDANT,
        dependantType:
          "CHILD1"
      },
      expected:
        "DEPENDENT"
    }

  ];

  const results = tests.map(function(test) {

    let actual = "";

    let error = "";

    try {

      actual =
        KGMIS_GetCardholderType_(
          test.person
        );

    } catch (err) {

      error =
        err && err.message
          ? err.message
          : String(err);

    }

    return {

      label:
        test.label,

      expected:
        test.expected,

      actual:
        actual,

      passed:
        !error &&
        actual === test.expected,

      error:
        error

    };

  });

  Logger.log(
    JSON.stringify(
      results,
      null,
      2
    )
  );

  return results;

}