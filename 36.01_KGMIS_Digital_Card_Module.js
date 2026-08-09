/**
 * ============================================================
 * KGMIS Production Digital Card Module
 *
 * File: 36.01_KGMIS_Digital_Card_Module.gs
 * ============================================================
 *
 * Purpose:
 * - Serve the production digital-card route
 * - Reuse the existing tested card renderer
 * - Keep the old development test route available temporarily
 */


/**
 * Renders the production Digital Card module.
 *
 * Current first-stage behaviour:
 * - Requires a cardId query parameter
 * - Reuses the existing KGMIS_RenderDigitalCard(cardId)
 *
 * Example:
 * ?module=digital-card&cardId=KEFG0003501
 */
function KGMIS_RenderDigitalCardModule_(
  e
) {

  const parameters =
    e && e.parameter
      ? e.parameter
      : {};

  const cardId =
    String(
      parameters.cardId ||
      parameters.cardid ||
      ''
    )
    .trim()
    .toUpperCase();

  if (!cardId) {

    throw new Error(
      'A CARD_ID is required to open the Digital Card module.'
    );

  }

  return KGMIS_RenderDigitalCard(
    cardId
  );

}