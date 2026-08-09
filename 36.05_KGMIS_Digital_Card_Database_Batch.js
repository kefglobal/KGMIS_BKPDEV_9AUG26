/**
 * ============================================================
 * SECTION 15.1 - PREPARE DATABASE BATCH
 * File: 36.05_KGMIS_Digital_Card_Database_Batch.gs
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_PrepareDatabaseBatch_(
  preparedCards
) {

  // Validate

  if (!Array.isArray(preparedCards)) {

    throw new Error(
      'Prepared card records must be provided as an array.'
    );

  }

  const inserts = [];

  const updates = [];

  preparedCards.forEach(

    function(item) {

      if (
        !item ||
        typeof item !== 'object'
      ) {
        return;
      }

      switch (item.action) {

        case 'INSERT':

          inserts.push(
            item.record
          );

          break;

        case 'UPDATE':

          updates.push(
            item.record
          );

          break;

        default:

          throw new Error(
            'Unknown database action: ' +
            item.action
          );

      }

    }

  );

  return {

    inserts:
      inserts,

    updates:
      updates,

    summary: {

      total:
        preparedCards.length,

      inserts:
        inserts.length,

      updates:
        updates.length

    }

  };

}

/**
 * ============================================================
 * 15.1 TEST - PREPARE DATABASE BATCH
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestPrepareDatabaseBatch() {

  const preparedCards = [

    {

      action:
        'INSERT',

      record: {

        CARD_ID:
          'KEFG0003501'

      }

    },

    {

      action:
        'UPDATE',

      record: {

        CARD_ID:
          'KEFG0003502'

      }

    },

    {

      action:
        'INSERT',

      record: {

        CARD_ID:
          'KEFG0003503'

      }

    }

  ];

  const batch =

    KGMIS_PrepareDatabaseBatch_(

      preparedCards

    );

  const result = {

    success:

      (

        batch.summary.total === 3 &&

        batch.summary.inserts === 2 &&

        batch.summary.updates === 1

      ),

    batch:
      batch

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

