'use strict';

const dbHelper = require('../helpers/dbHelper');
const User = require('../models/User');
const appHelper = require('../helpers/appHelper');

/**
 * GET Buying team.
 * @param {Request} req
 * @param {Response} res
 * @returns
 */
const Team = async (req, res, next) => {
  let teamLeads = await appHelper.getTeamLeads();
  let buyers = await appHelper.getBuyers();
  let assistances = await appHelper.getAssistances();
  // let list = await appHelper.geBuyersByWebIDs(['000', '028', '043'])

  res.render('pages/buying/team', {
    title: 'Команда Media Buying',
    // userError: req.flash('userError'),
    teamLeads,
    buyers,
    assistances
  });
}


module.exports = {
  Team
}
