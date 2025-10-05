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
const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');
const { processAndSaveAvatar } = require('../middlewares/uploadAvatar');
const mongoose = require('mongoose');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

// const WEBID_RE = /^w\d{3,}$/i;

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

// видаляє ВСІ сесії користувача з session-колекції (connect-mongodb-session)
async function revokeUserSessions(userId) {
  const col = mongoose.connection.collection('sessions');
  // у документі поле "session" — це JSON-рядок; шукаємо за "id":"<userId>"
  await col.deleteMany({ session: { $regex: `"id":"${String(userId)}"` } });
}

/**
 * GET: Users list (простий варіант)
 */
// --- LIST (усі фільтри лишаємо, сортування теж) ---
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

    // фільтр
    const find = {};
    if (q && q.trim()) {
      const re = new RegExp(q.trim(), 'i');
      find.$or = [{ firstName: re }, { lastName: re }, { email: re }, { webId: re }];
    }
    if (department) find.department = department;
    if (orgRole) find.orgRole = orgRole;       // хоч і не редагується тут, але доступний для фільтра
    if (teamRole) find.teamRole = teamRole;    // те саме
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

      // фільтри (залишені всі)
      departments,
      orgRoles,
      teamRoles,
      query: { q, department, orgRole, teamRole, active },

      // пагінація
      pagination: { page: safePage, limit, total, totalPages, pages, prevUrl, nextUrl },

      // сортування
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
    departments: await getDepartmentOptions(),   // тільки відділи
  });
};

/**
 * POST: Create new user
 */
const AddUser = async (req, res) => {
  try {
    const actor = req.session?.user || null;
    const scopes = new Set(getUserScopes(actor));
    const canWriteAny = scopes.has(SCOPES.ORG_USERS_WRITE_ANY);
    const canCreateBasic = scopes.has(SCOPES.ORG_USERS_CREATE_BASIC);

    if (!canWriteAny && !canCreateBasic) {
      req.flash('userError', 'Недостатньо прав для створення користувача.');
      return res.redirect('/users');
    }

    const { firstName, lastName, email, password, telegramUsername, department } = req.body;

    let orgRole = 'user';     // за замовчуванням
    let teamRoleFinal = null; // базова форма без командних ролей
    let position = null;      // базова форма без позиції
    let webIdFinal = null;    // базова форма без webId

    // якщо адмін/менеджер з повними правами — можна дозволити orgRole з форми (за потреби)
    if (canWriteAny && req.body.orgRole) {
      orgRole = String(req.body.orgRole);
    }

    // Базові перевірки
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

    // Унікальність email
    const existing = await User.findOne({ email: emailNorm }).lean();
    if (existing) {
      req.flash('userError', 'Користувач з таким емейлом вже існує.');
      return redirectBack(res, req);
    }

    // Валідність відділу
    const deptOk = await Department.exists({ value: department, isActive: true });
    if (!deptOk) {
      req.flash('userError', 'Невірний відділ.');
      return redirectBack(res, req);
    }

    // Пароль
    const passwordHash = await dbHelper.hashPassword(password);

    // Створення з мінімальним набором полів:
    // orgRole — ФІКСОВАНО 'user'; teamRole/deptRole/webId/position — не чіпаємо
    await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: emailNorm,
      passwordHash,
      lastPasswordChangeAt: new Date(),
      telegramUsername: telegramUsername ? String(telegramUsername).trim() : null,

      department,
      orgRole: orgRole,   // ← завжди user при створенні
      team: null,
      teamRole: null,
      // deptRole: null,  // якщо є в моделі — теж null
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
 * GET: Edit user page
 */
// --- EDIT PAGE (мінімальні поля + відділ) ---
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

    // список відділів для селекта
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
 * POST: Edit user data (без зміни пароля)
 */
// --- EDIT SUBMIT (тільки базові поля) ---
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

    // --- Базові перевірки ---
    if (!firstName?.trim() || !lastName?.trim()) {
      req.flash('userError', 'Будь ласка, заповни імʼя та прізвище.');
      return res.redirect(`/users/edit/${id}?allow=1`);
    }

    if (!email?.trim()) {
      req.flash('userError', 'Будь ласка, вкажи емейл.');
      return res.redirect(`/users/edit/${id}?allow=1`);
    }

    const emailNorm = String(email).trim().toLowerCase();

    // --- Перевірка унікальності email (якщо змінився) ---
    if (emailNorm !== current.email) {
      const emailTaken = await User.exists({ _id: { $ne: id }, email: emailNorm });
      if (emailTaken) {
        req.flash('userError', 'Користувач з таким емейлом вже існує.');
        return res.redirect(`/users/edit/${id}?allow=1`);
      }
    }

    // --- Перевірка валідності відділу ---
    const deptOk = await Department.exists({ value: department, isActive: true });
    if (!deptOk) {
      req.flash('userError', 'Невірний відділ.');
      return res.redirect(`/users/edit/${id}?allow=1`);
    }

    // --- Оновлюємо тільки базові поля ---
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
 * GET: User profile page
 * Доступ:
 *  - власний профіль: завжди
 *  - чужий профіль: вимагає ORG_USERS_READ_ANY
 */
const ProfilePage = async (req, res) => {
  try {
    const id = req.params.id;
    const sessionUser = req.session?.user || null;
    const isSelf = !!(sessionUser && String(sessionUser._id || sessionUser.id) === String(id));

    const scopes = new Set(getUserScopes(sessionUser));
    if (!isSelf && !scopes.has(SCOPES.ORG_USERS_READ_ANY)) {
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
      isSelf,
      canEdit: canEditUserBase(sessionUser, id),
      hasAvatar,
    });
  } catch (err) {
    console.error(err);
    req.flash('userError', 'Сталася помилка при завантаженні профілю.');
    return res.redirect('/users');
  }
};

// --- NEW: Видалення аватара ---
const DeleteAvatar = async (req, res) => {
  const id = req.params.id;
  try {
    const me = req.session?.user || null;
    if (!canEditUserBase(me, id)) {
      req.flash('userError', 'Недостатньо прав для видалення аватара.');
      return res.redirect(`/users/${id}`);
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'avatars', `${id}.webp`);
    try {
      if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
    } catch (e) {
      // якщо не вдалося видалити — логнемо, але не валимо UX
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
    req.flash('userError', 'Сталася помилка, звернись до адміністратора. ' + error.message);
    res.redirect('/users');
  }
};

/**
 * POST: Deactivate User
 */
const DeactivateUser = async (req, res) => {
  try {
    const { id } = req.params;

    // не дозволяємо вимикати самого себе
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

    // кілл усіх його сесій
    await revokeUserSessions(id);

    req.flash('userSuccess', `Користувача ${user.firstName || ''} ${user.lastName || ''} деактивовано.`);
    return res.redirect('/users');
  } catch (e) {
    console.error(e);
    req.flash('userError', 'Не вдалося деактивувати користувача.');
    return res.redirect('/users');
  }
};

/**
 * POST: Activate User
 */
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

// Віддати картинку: якщо нема — віддати плейсхолдер
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

const canEditUserBase = (sessionUser, targetUserId) => {
  const scopes = new Set(getUserScopes(sessionUser));
  const isSelf = sessionUser && String(sessionUser._id || sessionUser.id) === String(targetUserId);
  return isSelf || scopes.has(SCOPES.ORG_USERS_WRITE_ANY);
};

// Сторінка завантаження
const UploadAvatarPage = async (req, res) => {
  try {
    const id = req.params.id;
    const me = req.session?.user || null;
    if (!canEditUserBase(me, id)) {
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

// Обробка аплоаду
const UploadAvatar = async (req, res) => {
  const id = req.params.id;
  try {
    const me = req.session?.user || null;
    if (!canEditUserBase(me, id)) {
      req.flash('userError', 'Недостатньо прав для зміни аватара.');
      return res.redirect('/users');
    }

    if (!req.file) {
      req.flash('userError', 'Файл не отримано.');
      return res.redirect(`/users/${id}/avatar/upload`);
    }

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
