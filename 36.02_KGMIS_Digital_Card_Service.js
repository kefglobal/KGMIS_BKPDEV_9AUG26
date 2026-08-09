/**
 * ============================================================
 * KGMIS Enterprise Edition
 * Digital Card Service Layer
 *
 * File:
 * 36.02_KGMIS_Digital_Card_Service.gs
 * ============================================================
 *
 * Purpose
 * -------
 * This layer contains all business logic required to build a
 * Digital Card.
 *
 * The Renderer must never read the database directly.
 *
 * The Service will:
 *
 *   ✓ Read Card Registry
 *   ✓ Read Master Database
 *   ✓ Read Financial Year
 *   ✓ Validate eligibility
 *   ✓ Build the View Model
 *
 * The Renderer will only render.
 * ============================================================
 */


/**
 * Returns the complete Digital Card View Model.
 */
function KGMIS_GetDigitalCardViewModel_(
  cardId
) {

  return KGMIS_BuildDigitalCardViewModel_(
    cardId
  );

}
