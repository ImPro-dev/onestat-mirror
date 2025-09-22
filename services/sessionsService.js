// services/sessionsService.js
'use strict';

const mongoose = require('mongoose');

// назва колекції з сесіями (подивись в Mongo що у тебе реально: "sessions", "mySessions", тощо)
const SESSIONS_COLLECTION = process.env.SESSION_COLLECTION || 'sessions';

/**
 * Повертає список документів сесій для даного userId.
 * ПАМ'ЯТАЙ: connect-mongodb-session зберігає `session` як JSON-рядок.
 */
async function getUserSessions(userId) {
  const col = mongoose.connection.collection(SESSIONS_COLLECTION);
  const docs = await col.find({}, { projection: { _id: 1, session: 1 } }).toArray();

  const out = [];
  for (const doc of docs) {
    try {
      const parsed = typeof doc.session === 'string' ? JSON.parse(doc.session) : doc.session;
      // очікуємо, що в сесії ти кладеш req.session.user = { _id, ... }
      const sidUserId = parsed?.user?._id;
      if (sidUserId && String(sidUserId) === String(userId)) {
        out.push({ _id: doc._id, session: parsed });
      }
    } catch (_e) {
      // пропускаємо биті/нестандартні сесії
    }
  }
  return out;
}

/**
 * Видаляє всі сесії користувача, крім вказаної (поточної).
 * @param {string|ObjectId} userId
 * @param {string} keepSessionId - req.session.id (SID, зберігається у _id документа)
 */
async function killOtherSessions(userId, keepSessionId) {
  const userSessions = await getUserSessions(userId);
  const toDeleteIds = userSessions
    .filter(s => String(s._id) !== String(keepSessionId))
    .map(s => s._id);

  if (!toDeleteIds.length) return { deletedCount: 0 };

  const col = mongoose.connection.collection(SESSIONS_COLLECTION);
  const res = await col.deleteMany({ _id: { $in: toDeleteIds } });
  return { deletedCount: res.deletedCount || 0 };
}

module.exports = {
  getUserSessions,
  killOtherSessions,
  SESSIONS_COLLECTION,
};
