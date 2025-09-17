// controllers/userController.js
'use strict';

const User = require('../models/User');
const OrgRole = require('../models/OrgRole');
const TeamRole = require('../models/TeamRole');
const Department = require('../models/Department');
const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');

const dbHelper = require('../helpers/dbHelper');
const { getOrgRoleOptions, getTeamRoleOptions, getDepartmentOptions } = require('../services/enumsService');

const WEBID_RE = /^w\d{3,}$/i;

// Helpers
function redirectBack(res, req, path = '/users/add') {
  const suffix = req.body?.department ? `?department=${encodeURIComponent(req.body.department)}` : '';
  return res.redirect(path + suffix);
}
function redirectToEdit(res, id) {
  return res.redirect(`/users/edit/${id}?allow=1`);
}

// ---- helpers для списку ----
function buildUserFilters(query) {
  const { q, department, orgRole, teamRole, active } = query;
  const filter = {};

  if (department) filter.department = department;
  if (orgRole) filter.orgRole = orgRole;
  if (teamRole) filter.teamRole = teamRole;

  if (active === 'true') filter.isActive = true;
  if (active === 'false') filter.isActive = false;

  if (q && q.trim()) {
    const re = new RegExp(q.trim(), 'i');
    filter.$or = [
      { firstName: re },
      { lastName: re },
      { email: re },
      { webId: re },
    ];
  }
  return filter;
}

/**
 * GET: Users list (простий варіант)
 */
const UserList = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = buildUserFilters(req.query);

    const [users, total, orgRoles, departments, teamRoles] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
      getOrgRoleOptions(),
      getDepartmentOptions(),
      getTeamRoleOptions(),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    res.render('pages/users/list', {
      title: 'Користувачі',
      userError: req.flash('userError'),
      userSuccess: req.flash('userSuccess'),

      // дані таблиці
      users,

      // пагінація/фільтри
      page, limit, total, totalPages,
      query: {
        q: req.query.q || '',
        department: req.query.department || '',
        orgRole: req.query.orgRole || '',
        teamRole: req.query.teamRole || '',
        active: req.query.active ?? '',
      },

      // довідники для селектів
      orgRoles,
      departments,
      teamRoles,

      // для умов у шаблоні (наприклад, заборона видалення себе)
      myID: req.session?.user?.id || null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET: Add user page
 */
const AddUserPage = async (req, res) => {
  res.render('pages/users/add', {
    title: 'Новий користувач',
    userError: req.flash('userError'),
    userSuccess: req.flash('userSuccess'),
    orgRoles: await getOrgRoleOptions(),        // [{value,label}]
    departments: await getDepartmentOptions(),  // [{value,label}]
    teamRoles: await getTeamRoleOptions(),      // [{value,label}]
    currentDept: req.query.department || 'Media Buying'
  });
};

/**
 * POST: Create new user
 */
const AddUser = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      telegramUsername,
      department,
      orgRole,
      teamRole,        // 'lead'|'member'|'assistant' | '' (для manager без команди)
      webId,
      position         // довільний лейбл для UI/HR
    } = req.body;

    // 1) базові перевірки
    if (!firstName?.trim() || !lastName?.trim()) {
      req.flash('userError', 'Будь ласка, заповни імʼя та прізвище.');
      return redirectBack(res, req);
    }
    if (!email?.trim()) {
      req.flash('userError', 'Будь ласка, вкажи емейл.');
      return redirectBack(res, req);
    }
    if (!password) {
      req.flash('userError', 'Пароль є обовʼязковим.');
      return redirectBack(res, req);
    }

    const emailNorm = String(email).trim().toLowerCase();

    // 2) унікальність email
    const existing = await User.findOne({ email: emailNorm }).lean();
    if (existing) {
      req.flash('userError', 'Користувач з таким емейлом вже існує.');
      return redirectBack(res, req);
    }

    // 3) валідація довідників
    const [orgRoleOk, deptOk] = await Promise.all([
      OrgRole.exists({ value: orgRole, isActive: true }),
      Department.exists({ value: department, isActive: true }),
    ]);
    if (!orgRoleOk) { req.flash('userError', 'Невірне значення рівня доступу (orgRole).'); return redirectBack(res, req); }
    if (!deptOk) { req.flash('userError', 'Невірний департамент.'); return redirectBack(res, req); }

    // 4) teamRole логіка
    let teamRoleFinal = null;
    if (orgRole === 'manager') {
      // менеджер може бути без командної ролі (Head of ...)
      teamRoleFinal = teamRole ? String(teamRole) : null;
    } else {
      if (!teamRole) {
        req.flash('userError', 'Будь ласка, вибери роль у команді (teamRole).');
        return redirectBack(res, req);
      }
      teamRoleFinal = String(teamRole);
    }
    if (teamRoleFinal) {
      const teamRoleOk = await TeamRole.exists({ value: teamRoleFinal, isActive: true });
      if (!teamRoleOk) { req.flash('userError', 'Невірна роль у команді (teamRole).'); return redirectBack(res, req); }
    }

    // 5) webId: обовʼязковий для департаменту Media Buying
    let webIdFinal = null;
    if (department === 'Media Buying') {
      if (!webId || !WEBID_RE.test(webId)) {
        req.flash('userError', 'Для департаменту Media Buying потрібен WebID у форматі wNNN (наприклад, w043).');
        return redirectBack(res, req);
      }
      const taken = await User.exists({ webId: webId.toLowerCase() });
      if (taken) {
        req.flash('userError', `WebID ${webId} вже використовується.`);
        return redirectBack(res, req);
      }
      webIdFinal = webId.toLowerCase();
    } else {
      webIdFinal = null;
    }

    // 6) хеш пароля
    const passwordHash = await dbHelper.hashPassword(password);

    // 7) створення
    await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailNorm,
      passwordHash,
      lastPasswordChangeAt: new Date(),
      telegramUsername: telegramUsername ? String(telegramUsername).trim() : null,
      position: position ? String(position).trim() : null,

      orgRole,
      department,
      team: null,                 // команду привʼяжеш окремо
      teamRole: teamRoleFinal,
      webId: webIdFinal,

      isActive: true,
    });

    req.flash('userSuccess', 'Користувача створено.');
    return res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('userError', 'Сталася помилка, звернись до Ігоря. ' + error.message);
    return redirectBack(res, req);
  }
};

/**
 * GET: Edit user page
 */
const EditUserPage = async (req, res) => {
  if (!req.query.allow) return res.redirect('/users');

  const user = await User.findById(req.params.id).lean();
  if (!user) {
    req.flash('userError', 'Користувача не знайдено.');
    return res.redirect('/users');
  }

  res.render('pages/users/edit', {
    title: 'Редагувати дані користувача',
    userError: req.flash('userError'),
    userSuccess: req.flash('userSuccess'),
    user,
    orgRoles: await getOrgRoleOptions(),
    departments: await getDepartmentOptions(),
    teamRoles: await getTeamRoleOptions()
  });
};

/**
 * POST: Edit user data (без зміни пароля)
 */
const EditUser = async (req, res) => {
  try {
    const {
      id,
      firstName,
      lastName,
      email,
      telegramUsername,
      department,
      orgRole,
      teamRole,     // ''/null для manager без команди
      webId,
      position
    } = req.body;

    if (!id) { req.flash('userError', 'Відсутній ідентифікатор користувача.'); return res.redirect('/users'); }

    const current = await User.findById(id).lean();
    if (!current) { req.flash('userError', 'Користувача не знайдено.'); return res.redirect('/users'); }

    // 1) базові перевірки
    if (!firstName?.trim() || !lastName?.trim()) {
      req.flash('userError', 'Будь ласка, заповни імʼя та прізвище.');
      return redirectToEdit(res, id);
    }
    if (!email?.trim()) {
      req.flash('userError', 'Будь ласка, вкажи емейл.');
      return redirectToEdit(res, id);
    }
    const emailNorm = String(email).trim().toLowerCase();

    // 2) унікальність email (якщо змінився)
    if (emailNorm !== current.email) {
      const emailTaken = await User.exists({ _id: { $ne: id }, email: emailNorm });
      if (emailTaken) { req.flash('userError', 'Користувач з таким емейлом вже існує.'); return redirectToEdit(res, id); }
    }

    // 3) валідація довідників
    const [orgRoleOk, deptOk] = await Promise.all([
      OrgRole.exists({ value: orgRole, isActive: true }),
      Department.exists({ value: department, isActive: true }),
    ]);
    if (!orgRoleOk) { req.flash('userError', 'Невірне значення orgRole.'); return redirectToEdit(res, id); }
    if (!deptOk) { req.flash('userError', 'Невірний департамент.'); return redirectToEdit(res, id); }

    // 4) teamRole логіка
    let teamRoleFinal = null;
    if (orgRole === 'manager') {
      teamRoleFinal = teamRole ? String(teamRole) : null;
    } else {
      if (!teamRole) { req.flash('userError', 'Будь ласка, вибери роль у команді (teamRole).'); return redirectToEdit(res, id); }
      teamRoleFinal = String(teamRole);
    }
    if (teamRoleFinal) {
      const teamRoleOk = await TeamRole.exists({ value: teamRoleFinal, isActive: true });
      if (!teamRoleOk) { req.flash('userError', 'Невірна роль у команді (teamRole).'); return redirectToEdit(res, id); }
    }

    // 5) webId: обовʼязковий для Media Buying, інакше null
    let webIdFinal = null;
    if (department === 'Media Buying') {
      if (!webId || !WEBID_RE.test(webId)) {
        req.flash('userError', 'Для департаменту Media Buying потрібен WebID у форматі wNNN (наприклад, w043).');
        return redirectToEdit(res, id);
      }
      const webIdNorm = webId.toLowerCase();
      if (webIdNorm !== (current.webId || '')) {
        const webIdTaken = await User.exists({ _id: { $ne: id }, webId: webIdNorm });
        if (webIdTaken) { req.flash('userError', `WebID ${webId} вже використовується.`); return redirectToEdit(res, id); }
      }
      webIdFinal = webId.toLowerCase();
    } else {
      webIdFinal = null;
    }

    // 6) якщо manager без команди — team = null (щоб не залишався привʼязаний)
    const update = {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailNorm,
      telegramUsername: telegramUsername ? String(telegramUsername).trim() : null,
      department,
      orgRole,
      teamRole: teamRoleFinal,
      webId: webIdFinal,
      position: position ? String(position).trim() : null,
    };
    if (orgRole === 'manager' && !teamRoleFinal) update.team = null;

    await User.findByIdAndUpdate(id, { $set: update }, { runValidators: true });

    req.flash('userSuccess', 'Дані користувача збережено.');
    return redirectToEdit(res, id);
  } catch (error) {
    console.error(error);
    req.flash('userError', 'Сталася помилка, звернись до Ігоря. ' + error.message);
    return res.redirect('/users');
  }
};

/**
 * GET: User profile page (залишаю як у тебе, мінімально)
 */
const ProfilePage = async (req, res) => {
  try {
    const id = req.params.id;
    const sessionUser = req.session?.user || null;
    const isSelf = sessionUser && String(sessionUser.id) === String(id);

    // Перевірка прав: свій профіль — дозволено; чужий — лише з ORG_USERS_READ_ANY
    const scopes = new Set(getUserScopes(sessionUser));
    if (!isSelf && !scopes.has(SCOPES.ORG_USERS_READ_ANY)) {
      req.flash('userError', 'У вас немає доступу до цього профілю.');
      return res.redirect('/dashboard');
    }

    const user = await User.findById(id)
      .select('firstName lastName email telegramUsername webId department orgRole teamRole position createdAt lastLoginAt')
      .lean();

    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/users');
    }

    res.render('pages/users/profile', {
      title: `Профіль · ${user.firstName || ''} ${user.lastName || ''}`.trim(),
      user,
      isSelf
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Сталася помилка при завантаженні профілю.');
    res.redirect('/users');
  }
};

/**
 * GET: Remove user (простий варіант)
 */
const RemoveUser = async (req, res) => {
  try {
    await User.deleteOne({ _id: req.params.id });
    req.flash('userSuccess', 'Користувача видалено.');
    res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('userError', 'Сталася помилка, звернись до Ігоря. ' + error.message);
    res.redirect('/users');
  }
};

module.exports = {
  UserList,
  AddUserPage,
  AddUser,
  EditUserPage,
  EditUser,
  ProfilePage,
  RemoveUser
};
