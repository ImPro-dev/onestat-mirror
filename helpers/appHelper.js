'use strict';

const User = require('../models/User');

/**
 * Get list of TeamLeades
 * @returns {array} users
 */
const getTeamLeads = async () => {
  try {
    let users = await User.find({
      department: "Media Buying",
      position: "Team Lead"
    }).lean();
    return users;
  } catch (err) {
    console.error("Помилка при пошуку користувачів:", err);
    // throw err;
  }
}

/**
 * Get list of Buyers
 * @returns {array} users
 */
const getBuyers = async () => {
  try {
    let users = await User.find({
      department: "Media Buying",
      position: { $in: ["Media Buyer", "Junior Media Buyer"] }
    }).lean();
    return users;
  } catch (err) {
    console.error("Помилка при пошуку користувачів:", err);
    // throw err;
  }
}

/**
 * Get list of Buyer Assistances
 * @returns {array} users
 */
const getAssistances = async () => {
  try {
    let users = await User.find({
      department: "Media Buying",
      position: "Assistant"
    }).lean();
    return users;
  } catch (err) {
    console.error("Помилка при пошуку користувачів:", err);
    // throw err;
  }
}

const geBuyersByWebIDs = async (webIDs) => {
  try {
    const users = await User.find({
      webID: { $in: webIDs } // Умови для вибірки
    }, "firstname lastname").lean();

    console.log(users[0]); // Виводимо знайдених користувачів у консоль
    return users;
  } catch (err) {
    console.error("Помилка при пошуку користувачів:", err);
    throw err;
  }
}

module.exports = {
  getTeamLeads,
  getBuyers,
  getAssistances,
  geBuyersByWebIDs
};
