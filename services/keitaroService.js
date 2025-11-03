'use strict';

/**
 * Keitaro integration (mocked).
 * This module emulates a 3rd-party call and returns a canonical response:
 * {
 *   success: true,
 *   requestId: string,
 *   externalCampaignId: string|number,
 *   message: string,
 *   refLink: "https://stvg3yms.playpwatop.com/STVg4yMS?external_id={clickId}"
 * }
 */

function _randId(prefix = 'req') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

/**
 * Mocked API call to Keitaro to get/create a campaign and produce a referral link.
 * @param {Object} params
 * @param {number} params.templateId
 * @param {string} params.campaignName
 * @param {Object} params.offer - minimal offer data
 * @param {Object} params.user  - minimal user data
 * @returns {Promise<{success:boolean, requestId:string, externalCampaignId:string, message:string, refLink:string}>}
 */
async function createCampaignRefLink({ templateId, campaignName, offer, user }) {
  // Emulate network latency
  await new Promise(r => setTimeout(r, 30));

  // Compose a stable pseudo external campaign id (mock)
  const externalCampaignId = `kt_${templateId}_${(offer && offer._id) || 'offer'}_${(user && user._id) || 'user'}`;

  // Use a canonical example ref link format with {clickId} placeholder
  const refLink = 'https://stvg3yms.playpwatop.com/STVg4yMS?external_id={clickId}';

  return {
    success: true,
    requestId: _randId('keitaro'),
    externalCampaignId,
    message: 'Mocked Keitaro response',
    refLink,
  };
}

module.exports = {
  createCampaignRefLink,
};
