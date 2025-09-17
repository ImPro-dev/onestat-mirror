// controllers/teamController.js
'use strict';

const mongoose = require('mongoose');
const Team = require('../models/Team');
const User = require('../models/User');

const WEBID_RE = /^w\d{3,}$/i;

function assert(cond, msg) {
  if (!cond) {
    const e = new Error(msg);
    e.status = 400;
    throw e;
  }
}

/**
 * GET /teams/create — сторінка створення
 * (простий варіант: вибрати назву, департамент, лідера, учасників)
 */
const CreateTeamPage = async (req, res, next) => {
  try {
    const candidates = await User.find({ isActive: true, team: null })
      .select('firstName lastName email orgRole department webId teamRole')
      .sort({ firstName: 1 })
      .lean();

    res.render('pages/teams/create', {
      title: 'Створити команду',
      candidates, // користувачі без команди (щоб не ламати одно-командне правило)
      teamError: req.flash('teamError'),
    });
  } catch (e) { next(e); }
};

/**
 * POST /teams/create — створити команду + розставити ролі
 * body: { name, department, leadId, members: [{ userId, role, webId? }] }
 */
const CreateTeam = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, department, leadId } = req.body;
    let members = req.body.members || []; // очікуємо масив

    assert(name?.trim(), 'Назва команди є обовʼязковою.');
    assert(department?.trim(), 'Департамент є обовʼязковим.');
    assert(leadId, 'Lead є обовʼязковим.');

    // 1) Перевірити, що лідер існує, активний і не в команді
    const lead = await User.findById(leadId).session(session);
    assert(lead, 'Ліда не знайдено.');
    assert(lead.isActive, 'Лід не активний.');
    assert(!lead.team, 'Лід вже привʼязаний до іншої команди.');
    assert(lead.orgRole !== 'admin', 'Admin не може бути лідом команди.'); // бізнес-правило (за бажанням)

    // 2) Створити команду
    const team = await Team.create([{
      name: name.trim(),
      department: department.trim(),
      lead: lead._id,
      members: [], // заповнимо нижче
    }], { session });
    const teamDoc = team[0];

    // 3) Призначити лідера: user.team, user.teamRole='lead'
    lead.team = teamDoc._id;
    lead.teamRole = 'lead';
    // ВАЖЛИВО: лід не повинен мати webId — очищаємо, якщо раптом був
    lead.webId = null;
    await lead.save({ session });

    // 4) Обробити учасників (buyer/assistant)
    // members: [{ userId, role, webId? }]
    if (!Array.isArray(members)) {
      try { members = JSON.parse(members); } catch { /* ігнор */ }
      if (!Array.isArray(members)) members = [];
    }

    // Зберемо унікальні userIds
    const memberIds = members.map(m => m.userId).filter(Boolean);
    const uniqIds = [...new Set(memberIds)];
    const users = await User.find({ _id: { $in: uniqIds } }).session(session);

    // мапа для швидкого пошуку
    const byId = new Map(users.map(u => [String(u._id), u]));

    for (const m of members) {
      const u = byId.get(String(m.userId));
      assert(u, 'Учасника не знайдено.');
      assert(u.isActive, 'Учасник не активний.');
      assert(!u.team, 'Учасник вже привʼязаний до іншої команди.');
      // для простоти: участь лише в тій же department, що й команда
      assert(u.department === teamDoc.department,
        `Учасник (${u.email}) з департаменту "${u.department}", а команда — "${teamDoc.department}".`);

      // роль
      assert(['member', 'assistant'].includes(m.role), 'Некоректна роль учасника.');
      u.team = teamDoc._id;
      u.teamRole = m.role;

      // webId: обовʼязково для member (buyer), заборонено/очищаємо для assistant
      if (m.role === 'member') {
        assert(m.webId && WEBID_RE.test(m.webId), 'Для buyer потрібен webId у форматі wNNN (наприклад, w043).');
        // унікальність webId гарантує unique sparse індекс у моделі User; додатково перевіримо вручну
        const exists = await User.findOne({ _id: { $ne: u._id }, webId: m.webId }).session(session).lean();
        assert(!exists, `webId "${m.webId}" вже використовується.`);
        u.webId = m.webId.toLowerCase();
      } else {
        // assistant — не має webId
        u.webId = null;
      }

      await u.save({ session });
      // додати до списку members команди
      teamDoc.members.push(u._id);
    }

    await teamDoc.save({ session });

    await session.commitTransaction();
    session.endSession();

    req.flash('teamSuccess', 'Команду створено успішно.');
    res.redirect(`/teams/${teamDoc._id}`);
  } catch (e) {
    await session.abortTransaction().catch(() => { });
    session.endSession();
    console.error(e);
    req.flash('teamError', e.message || 'Сталася помилка під час створення команди.');
    res.redirect('/teams/create');
  }
};

module.exports = {
  CreateTeamPage,
  CreateTeam,
};
