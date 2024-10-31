const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Connection to the MongoDB
 * @param {String} MONGODB_URI
 */
const dbConnect = async (MONGODB_URI) => {
  try {
    const connect = await mongoose.connect(MONGODB_URI);
    console.log(`DB Connected : ${connect.connection.host}, ${connect.connection.name}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

/**
 * Hash entered password
 * @param {String} password
 * @returns hashed password
 */
const hashPassword = (password) => {
  return bcrypt.hash(password, 10)
}

/**
 * Compare user password from DB and entered password
 * @param {String} userPassword
 * @param {String} candidatePassword
 * @returns {Bollean}
 */
const comparePassword = (userPassword, candidatePassword) => {
  return bcrypt.compare(userPassword, candidatePassword);
}

module.exports = {
  dbConnect,
  hashPassword,
  comparePassword
};
