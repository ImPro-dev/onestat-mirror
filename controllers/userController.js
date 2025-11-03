// controllers/userController.js
'use strict';

const User = require('../models/User');
const Team = require('../models/Team');
const Department = require('../models/Department');

const dbHelper = require('../helpers/dbHelper');
const {
  getOrgRoleOptions,
  getDepartmentOptions,
  getTeamRoleOptionsAll,
  getTeamRoleOptionsByDept } = require('../services/enumsService');

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { canReadUserProfile, canEditUserBasic, buildFlags } = require('../helpers/acl');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

// Helpers
function redirectBack(res, req, path = '/users/add') {
  const suffix = req.body?.department ? `?department=${encodeURIComponent(req.body.department)}` : '';
  return res.redirect(path + suffix);
}

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}
function buildUrl(base, params) {
  const qs = new URLSearchParams(params);
  return `${base}?${qs.toString()}`;
}

// Remove all user sessions from connect-mongodb-session collection
async function revokeUserSessions(userId) {
  const col = mongoose.connection.collection('sessions');
  await col.deleteMany({ session: { $regex: `"id":"${String(userId)}"` } });
}

/**
 * GET: Users list
 */
const UserList = async (req, res) => {
  try {
    const {
      q = '',
      department = '',
      orgRole = '',
      teamRole = '',
      active = '',
      page: pageRaw = '1',
      limit: limitRaw = '10',
      sortBy: sortByRaw = 'createdAt',
      sortDir: sortDirRaw = 'desc',
    } = req.query;

    const ALLOWED_SORTS = new Set([
      'firstName', 'lastName', 'email', 'telegramUsername', 'webId',
      'department', 'orgRole', 'teamRole', 'position', 'isActive', 'createdAt'
    ]);

    const sortBy = ALLOWED_SORTS.has(sortByRaw) ? sortByRaw : 'createdAt';
    const sortDir = (String(sortDirRaw).toLowerCase() === 'asc') ? 'asc' : 'desc';
    const sort = { [sortBy]: sortDir === 'asc' ? 1 : -1 };

    const page = toInt(pageRaw, 1);
    const limit = toInt(limitRaw, 20);

    const find = {};
    if (q && q.trim()) {
      const re = new RegExp(q.trim(), 'i');
      find.$or = [{ firstName: re }, { lastName: re }, { email: re }, { webId: re }];
    }
    if (department) find.department = department;
    if (orgRole) find.orgRole = orgRole;
    if (teamRole) find.teamRole = teamRole;
    if (active === 'true') find.isActive = true;
    if (active === 'false') find.isActive = false;

    const total = await User.countDocuments(find);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const skip = (safePage - 1) * limit;

    const users = await User.find(find)
      .select('firstName lastName email telegramUsername webId department orgRole teamRole position isActive createdAt')
      .sort(sort).limit(limit).skip(skip).lean();

    const [departments, orgRoles] = await Promise.all([
      getDepartmentOptions(),
      getOrgRoleOptions(),
    ]);
    const teamRoles = department
      ? await getTeamRoleOptionsByDept(department)
      : await getTeamRoleOptionsAll();

    const baseQuery = { q, department, orgRole, teamRole, active, limit: String(limit), sortBy, sortDir };

    const makeSortUrls = (field) => ({
      asc: buildUrl('/users', { ...baseQuery, sortBy: field, sortDir: 'asc', page: '1' }),
      desc: buildUrl('/users', { ...baseQuery, sortBy: field, sortDir: 'desc', page: '1' }),
      activeDir: (sortBy === field ? sortDir : null),
    });

    const sortUrls = {
      firstName: makeSortUrls('firstName'),
      lastName: makeSortUrls('lastName'),
      email: makeSortUrls('email'),
      telegram: makeSortUrls('telegramUsername'),
      webId: makeSortUrls('webId'),
      department: makeSortUrls('department'),
      orgRole: makeSortUrls('orgRole'),
      teamRole: makeSortUrls('teamRole'),
      position: makeSortUrls('position'),
      isActive: makeSortUrls('isActive'),
      createdAt: makeSortUrls('createdAt'),
    };

    const pages = Array.from({ length: totalPages }, (_, i) => {
      const n = i + 1;
      return { n, url: buildUrl('/users', { ...baseQuery, page: String(n) }), active: n === safePage };
    });
    const prevUrl = buildUrl('/users', { ...baseQuery, page: String(Math.max(1, safePage - 1)) });
    const nextUrl = buildUrl('/users', { ...baseQuery, page: String(Math.min(totalPages, safePage + 1)) });

    res.render('pages/users/list', {
      title: 'Користувачі',
      users,

      // filters
      departments,
      orgRoles,
      teamRoles,
      query: { q, department, orgRole, teamRole, active },

      // pagination
      pagination: { page: safePage, limit, total, totalPages, pages, prevUrl, nextUrl },

      // sorting
      sortBy, sortDir, sortUrls,
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Не вдалося завантажити список користувачів.');
    res.redirect('/dashboard');
  }
};

/**
 * GET: Add user page
 */
const AddUserPage = async (req, res) => {
  res.render('pages/users/add', {
    title: 'Новий користувач',
    departments: await getDepartmentOptions(),
  });
};

/**
 * POST: Create new user
 * Teamlead may create a basic user (ORG_USERS_CREATE_BASIC).
 * Only Admin/Head (ORG_USERS_WRITE_ANY) may override orgRole at creation.
 */
const AddUser = async (req, res) => {
  try {
    const actor = req.session?.user || null;
    const flags = buildFlags(actor);

    const canWriteAny = flags.canUsersWriteAny;
    const canCreateBasic = flags.canUsersCreateBasic;

    if (!canWriteAny && !canCreateBasic) {
      req.flash('userError', 'Недостатньо прав для створення користувача.');
      return res.redirect('/users');
    }

    const { firstName, lastName, email, password, telegramUsername, department } = req.body;

    let orgRole = 'user';
    if (canWriteAny && req.body.orgRole) {
      orgRole = String(req.body.orgRole);
    }

    // basic validation
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

    const existing = await User.findOne({ email: emailNorm }).lean();
    if (existing) {
      req.flash('userError', 'Користувач з таким емейлом вже існує.');
      return redirectBack(res, req);
    }

    const deptOk = await Department.exists({ value: department, isActive: true });
    if (!deptOk) {
      req.flash('userError', 'Невірний відділ.');
      return redirectBack(res, req);
    }

    const passwordHash = await dbHelper.hashPassword(password);

    await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailNorm,
      passwordHash,
      lastPasswordChangeAt: new Date(),
      telegramUsername: telegramUsername ? String(telegramUsername).trim() : null,

      department,
      orgRole,
      team: null,
      teamRole: null,
      webId: null,
      position: null,

      isActive: true,
    });

    req.flash('userSuccess', 'Користувача створено.');
    return res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('userError', 'Сталася помилка, звернись до адміністратора. ' + error.message);
    return redirectBack(res, req);
  }
};

/**
 * GET: Edit user page (basic data only)
 */
const EditUserPage = async (req, res) => {
  try {
    if (!req.query.allow) {
      return res.redirect('/users');
    }

    const { id } = req.params;
    const user = await User.findById(id)
      .select('firstName lastName email telegramUsername department')
      .lean();

    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/users');
    }

    const departments = await getDepartmentOptions();

    return res.render('pages/users/edit', {
      title: 'Редагувати дані користувача',
      user,
      departments,
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Сталася помилка при завантаженні форми редагування.');
    return res.redirect('/users');
  }
};

/**
 * POST: Edit user (basic fields only)
 */
const EditUser = async (req, res) => {
  try {
    const { id, firstName, lastName, email, telegramUsername, department } = req.body;

    if (!id) {
      req.flash('userError', 'Відсутній ідентифікатор користувача.');
      return res.redirect('/users');
    }

    const current = await User.findById(id).select('email').lean();
    if (!current) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/users');
    }

    if (!firstName?.trim() || !lastName?.trim()) {
      req.flash('userError', 'Будь ласка, заповни імʼя та прізвище.');
      return res.redirect(`/users/edit/${id}?allow=1`);
    }

    if (!email?.trim()) {
      req.flash('userError', 'Будь ласка, вкажи емейл.');
      return res.redirect(`/users/edit/${id}?allow=1`);
    }

    const emailNorm = String(email).trim().toLowerCase();

    if (emailNorm !== current.email) {
      const emailTaken = await User.exists({ _id: { $ne: id }, email: emailNorm });
      if (emailTaken) {
        req.flash('userError', 'Користувач з таким емейлом вже існує.');
        return res.redirect(`/users/edit/${id}?allow=1`);
      }
    }

    const deptOk = await Department.exists({ value: department, isActive: true });
    if (!deptOk) {
      req.flash('userError', 'Невірний відділ.');
      return res.redirect(`/users/edit/${id}?allow=1`);
    }

    await User.findByIdAndUpdate(
      id,
      {
        $set: {
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          email: emailNorm,
          telegramUsername: telegramUsername ? String(telegramUsername).trim() : null,
          department
        }
      },
      { runValidators: true }
    );

    req.flash('userSuccess', 'Дані користувача збережено.');
    return res.redirect('/users');
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Сталася помилка, звернись до адміністратора. ' + err.message);
    return res.redirect('/users');
  }
};

/**
 * GET: Profile page
 * Access:
 *  - self: always
 *  - others: canReadUserProfile (ORG_USERS_READ_ANY)
 */
const ProfilePage = async (req, res) => {
  try {
    const id = req.params.id;
    const sessionUser = req.session?.user || null;

    if (!canReadUserProfile(sessionUser, id)) {
      req.flash('userError', 'У вас немає доступу до цього профілю.');
      return res.redirect('/dashboard');
    }

    const user = await User.findById(id)
      .select('firstName lastName email telegramUsername webId department orgRole teamRole position isActive createdAt lastLoginAt team')
      .populate('team', 'name department')
      .lean();

    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/users');
    }

    const hasAvatar = fs.existsSync(path.join(AVATAR_DIR, `${id}.webp`));

    return res.render('pages/users/profile', {
      title: `Профіль · ${`${user.firstName || ''} ${user.lastName || ''}`.trim()}`,
      user,
      isSelf: !!(sessionUser && String(sessionUser._id || sessionUser.id) === String(id)),
      canEdit: canEditUserBasic(sessionUser, id),
      hasAvatar,
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Сталася помилка при завантаженні профілю.');
    return res.redirect('/users');
  }
};

// Delete avatar
const DeleteAvatar = async (req, res) => {
  const id = req.params.id;
  try {
    const me = req.session?.user || null;
    if (!canEditUserBasic(me, id)) {
      req.flash('userError', 'Недостатньо прав для видалення аватара.');
      return res.redirect(`/users/${id}`);
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'avatars', `${id}.webp`);
    try {
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    } catch (e) {
      console.error('Avatar unlink error:', e);
    }

    await User.findByIdAndUpdate(id, { $unset: { avatarUpdatedAt: 1 } });

    req.flash('userSuccess', 'Аватар видалено.');
    return res.redirect(`/users/${id}`);
  } catch (e) {
    console.error(e);
    req.flash('userError', 'Не вдалося видалити аватар.');
    return res.redirect(`/users/${id}`);
  }
};

// Remove user
const RemoveUser = async (req, res) => {
  try {
    await User.deleteOne({ _id: req.params.id });
    req.flash('userSuccess', 'Користувача видалено.');
    res.redirect('/users');
  } catch (error) {
    console.error(error);
    req.flash('userError', 'Сталася помилка, звернись до адміністратора. ' + error.message);
    res.redirect('/users');
  }
};

// Deactivate user
const DeactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (String(req.session?.user?.id) === String(id)) {
      req.flash('userError', 'Не можна деактивувати власний обліковий запис.');
      return res.redirect('/users');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: false } },
      { new: true, lean: true }
    );
    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/users');
    }

    await revokeUserSessions(id);

    req.flash('userSuccess', `Користувача ${user.firstName || ''} ${user.lastName || ''} деактивовано.`);
    return res.redirect('/users');
  } catch (e) {
    console.error(e);
    req.flash('userError', 'Не вдалося деактивувати користувача.');
    return res.redirect('/users');
  }
};

// Activate user
const ActivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { isActive: true } },
      { new: true, lean: true }
    );
    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/users');
    }

    req.flash('userSuccess', `Користувача ${user.firstName || ''} ${user.lastName || ''} активовано.`);
    return res.redirect('/users');
  } catch (e) {
    console.error(e);
    req.flash('userError', 'Не вдалося активувати користувача.');
    return res.redirect('/users');
  }
};

// Serve avatar
const ServeAvatar = async (req, res) => {
  try {
    const userId = req.params.id;
    const filePath = path.join(__dirname, '..', 'uploads', 'avatars', `${userId}.webp`);
    const placeholder = path.join(__dirname, '..', 'public', 'images', 'users', 'user-01-165x165.png');

    if (fs.existsSync(filePath)) {
      res.type('image/webp');
      return fs.createReadStream(filePath).pipe(res);
    } else {
      res.type('png');
      return fs.createReadStream(placeholder).pipe(res);
    }
  } catch (e) {
    console.error(e);
    return res.sendStatus(404);
  }
};

// Upload avatar page
const UploadAvatarPage = async (req, res) => {
  try {
    const id = req.params.id;
    const me = req.session?.user || null;
    if (!canEditUserBasic(me, id)) {
      req.flash('userError', 'Недостатньо прав для зміни аватара.');
      return res.redirect('/users');
    }

    const user = await User.findById(id).select('firstName lastName').lean();
    if (!user) {
      req.flash('userError', 'Користувача не знайдено.');
      return res.redirect('/users');
    }

    return res.render('pages/users/avatar', {
      title: `Аватар · ${user.firstName || ''} ${user.lastName || ''}`.trim(),
      user,
    });
  } catch (e) {
    console.error(e);
    req.flash('userError', 'Помилка завантаження сторінки аватара.');
    return res.redirect('/users');
  }
};

// Handle avatar upload
const UploadAvatar = async (req, res) => {
  const id = req.params.id;
  try {
    const me = req.session?.user || null;
    if (!canEditUserBasic(me, id)) {
      req.flash('userError', 'Недостатньо прав для зміни аватара.');
      return res.redirect(`/users/${id}`);
    }

    if (!req.file) {
      req.flash('userError', 'Файл не отримано.');
      return res.redirect(`/users/${id}/avatar/upload`);
    }

    const { processAndSaveAvatar } = require('../middlewares/uploadAvatar');
    await processAndSaveAvatar(id, req.file.buffer);
    await User.findByIdAndUpdate(id, { $set: { avatarUpdatedAt: new Date() } });

    req.flash('userSuccess', 'Аватар оновлено.');
    return res.redirect(`/users/${id}`);
  } catch (e) {
    console.error(e);
    req.flash('userError', e.message || 'Не вдалося оновити аватар.');
    return res.redirect(`/users/${id}/avatar/upload`);
  }
};

module.exports = {
  UserList,
  AddUserPage,
  AddUser,
  EditUserPage,
  EditUser,
  ProfilePage,
  RemoveUser,
  DeactivateUser,
  ActivateUser,
  ServeAvatar,
  UploadAvatarPage,
  UploadAvatar,
  DeleteAvatar
};
