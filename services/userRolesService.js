// services/userRolesService.js
'use strict';

const mongoose = require('mongoose');
const { Types } = mongoose;
const Team = require('../models/Team');
const enumsService = require('./enumsService');

/* ---------- enums lookups через enumsService ---------- */
async function getOrgRoleDoc(value) {
  if (!value) return null;
  const { orgRoles } = await enumsService.getAllEnumsRaw();
  return orgRoles.find(r => r.value === value) || null;
}
async function getDeptRoleDoc(department, value) {
  if (!department || !value) return null;
  const { deptRoles } = await enumsService.getAllEnumsRaw();
  return deptRoles.find(r => r.department === department && r.value === value) || null;
}
async function getTeamRoleDoc(department, value) {
  if (!department || !value) return null;
  const { teamRoles } = await enumsService.getAllEnumsRaw();
  return teamRoles.find(r => r.department === department && r.value === value) || null;
}

/* ---------- семантика ролей ---------- */
const isAdmin = (orgRoleDoc) => orgRoleDoc?.value === 'admin';
const isManager = (orgRoleDoc) => orgRoleDoc?.value === 'manager';
const isDeptHeadVal = (val) => val === 'head';
function teamKindVal(val) {
  if (val === 'lead') return 'lead';
  if (val === 'member') return 'member';
  if (val === 'assistant') return 'assistant';
  return null;
}

/* ---------- доступи ---------- */
async function canChangeOrgRole(actor, nextOrgRole) {
  const actorRoleDoc = await getOrgRoleDoc(actor?.orgrole || actor?.orgRole);
  if (!actorRoleDoc) return false;
  if (isAdmin(actorRoleDoc)) return true;
  if (isManager(actorRoleDoc)) {
    return nextOrgRole === 'user' || nextOrgRole === 'manager';
  }
  return false;
}
function canChangeDeptTeam(actor, targetDepartment) {
  // Admin — всюди; Head — лише свій департамент
  const orgrole = actor?.orgrole ?? actor?.orgRole ?? null;
  const deptrole = actor?.deptrole ?? actor?.deptRole ?? null;
  const dept = actor?.department ?? null;
  if (orgrole === 'admin') return true;
  if (isDeptHeadVal(deptrole) && dept && targetDepartment && dept === targetDepartment) return true;
  return false;
}

/* ---------- допоміжні ---------- */
const toObjectIdOrNull = (v) => (v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null);

async function removeUserFromAllTeamsMembers(userId, session) {
  await Team.updateMany(
    { members: userId },
    { $pull: { members: userId } },
    { session }
  );
}
async function ensureUserMemberOfTeam(teamId, userId, session) {
  if (!teamId) return;
  await Team.updateOne(
    { _id: teamId },
    { $addToSet: { members: userId } },
    { session }
  );
}

/**
 * Атомарне оновлення ролей/прив'язок користувача з усіма правилами.
 * Кононічні поля: team(ObjectId), assistantOf(ObjectId), webId(string|null).
 *
 * @param {mongoose.Model} UserModel
 * @param {string} userId
 * @param {{
 *   orgRole?: 'admin'|'manager'|'user',
 *   department?: string,
 *   deptRole?: 'head'|null,
 *   teamRole?: 'lead'|'member'|'assistant'|null,
 *   team?: string|null,          // ObjectId
 *   assistantOf?: string|null,   // ObjectId
 *   webId?: string|null
 * }} payload
 * @param {{ orgrole?: string, orgRole?: string, deptrole?: string|null, deptRole?: string|null, department?: string|null }} actor
 * @returns {Promise<mongoose.Document>} збережений user (актуальний стан)
 */
async function patchUserRoles(UserModel, userId, payload, actor) {
  if (!actor) throw new Error('Unauthorized');

  // Нормалізація ключів (приймаємо старі й нові)
  const p = {
    orgRole: payload.orgRole ?? payload.orgrole,
    department: payload.department,
    deptRole: payload.deptRole ?? payload.deptrole,
    teamRole: payload.teamRole ?? payload.teamrole,
    team: payload.team,
    assistantOf: payload.assistantOf ?? payload.supervisorId, // сумісність
    webId: payload.webId ?? payload.webID
  };

  // Доступ на зміну orgRole
  if (typeof p.orgRole !== 'undefined') {
    const ok = await canChangeOrgRole(actor, p.orgRole);
    if (!ok) throw new Error('Forbidden to change orgRole');
  }

  const userCurrent = await UserModel.findById(userId).lean();
  if (!userCurrent) throw new Error('User not found');

  const nextDepartment = (typeof p.department !== 'undefined') ? p.department : userCurrent.department;

  // Доступ на зміну департаментних/командних полів
  if (
    typeof p.department !== 'undefined' ||
    typeof p.deptRole !== 'undefined' ||
    typeof p.teamRole !== 'undefined' ||
    typeof p.team !== 'undefined' ||
    typeof p.assistantOf !== 'undefined' ||
    typeof p.webId !== 'undefined'
  ) {
    if (!canChangeDeptTeam(actor, nextDepartment)) {
      throw new Error('Forbidden to change department/team fields');
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await UserModel.findById(userId).session(session);
    if (!user) throw new Error('User not found');

    // Зберігаємо попередні значення
    const prevTeamId = user.team ? String(user.team) : null;
    const prevRole = user.teamRole || null;

    // Довідники (валідація значень по БД)
    const newOrgRoleDoc = p.orgRole ? await getOrgRoleDoc(p.orgRole) : null;
    const newDeptRoleDoc = p.deptRole ? await getDeptRoleDoc(nextDepartment, p.deptRole) : null;
    const newTeamRoleDoc = p.teamRole ? await getTeamRoleDoc(nextDepartment, p.teamRole) : null;

    if (p.orgRole && !newOrgRoleDoc) throw new Error('OrgRole not found');
    if (p.deptRole && !newDeptRoleDoc) throw new Error('DeptRole not found for department');
    if (p.teamRole && !newTeamRoleDoc) throw new Error('TeamRole not found for department');

    // Плоскі присвоєння (порядок важливий)
    if (typeof p.orgRole !== 'undefined') user.orgRole = p.orgRole;
    if (typeof p.department !== 'undefined') user.department = p.department;

    // Якщо змінили department — скидаємо командні поля
    if (typeof p.department !== 'undefined' && p.department !== userCurrent.department) {
      user.deptRole = 'none';
      user.teamRole = null;
      user.team = null;
      user.assistantOf = null;
      user.webId = null;
      await removeUserFromAllTeamsMembers(user._id, session);
    }

    if (typeof p.deptRole !== 'undefined') user.deptRole = (p.deptRole || 'none');
    if (typeof p.teamRole !== 'undefined') user.teamRole = (p.teamRole || null);
    if (typeof p.team !== 'undefined') user.team = toObjectIdOrNull(p.team);
    if (typeof p.assistantOf !== 'undefined') user.assistantOf = toObjectIdOrNull(p.assistantOf);
    if ('webId' in p) user.webId = p.webId || null;

    // ---- БІЗНЕС-ПРАВИЛА ----
    if (user.orgRole === 'admin') {
      // Admin → не має командних ролей/звʼязків
      user.deptRole = 'none';
      user.teamRole = null;
      user.team = null;
      user.assistantOf = null;
      user.webId = null;
      await removeUserFromAllTeamsMembers(user._id, session);
    } else if (isDeptHeadVal(user.deptRole)) {
      // Head → теж без командної ролі
      user.teamRole = null;
      user.team = null;
      user.assistantOf = null;
      user.webId = null;
      await removeUserFromAllTeamsMembers(user._id, session);
      // position: встановимо з label довідника (best-effort)
      try {
        const opts = await enumsService.getDeptRoleOptionsByDept(user.department);
        const headOpt = Array.isArray(opts) ? opts.find(o => o.value === 'head') : null;
        user.position = headOpt?.label || user.position || 'Head';
      } catch {
        user.position = user.position || 'Head';
      }
    } else {
      // Не Admin/Head — обробляємо teamRole
      const kind = teamKindVal(user.teamRole);

      if (kind === 'lead') {
        if (!user.team) throw new Error('Lead must have a team');

        const team = await Team.findById(user.team).session(session);
        if (!team) throw new Error('Team not found');
        if (team.isActive === false) throw new Error('Team is not active');
        if (team.department !== user.department) {
          throw new Error('Team department mismatch with user.department');
        }

        // Унікальний лідер у команді
        if (team.lead && String(team.lead) !== String(user._id)) {
          throw new Error('This team already has a different lead');
        }
        // Якщо змінили команду — знімаємо лідерство зі старої
        if (prevTeamId && prevTeamId !== String(team._id)) {
          const oldTeam = await Team.findById(prevTeamId).session(session);
          if (oldTeam && String(oldTeam.lead) === String(user._id)) {
            oldTeam.lead = null;
            await oldTeam.save({ session });
          }
        }
        if (!team.lead || String(team.lead) !== String(user._id)) {
          team.lead = user._id;
          await team.save({ session });
        }
        // Лід не має бути у members
        await removeUserFromAllTeamsMembers(user._id, session);

        // webId лише для Media Buying; інакше — очищаємо
        if (user.department !== 'Media Buying') user.webId = null;

        // Лід не має наставника
        user.assistantOf = null;

      } else if (kind === 'member') {
        if (!user.team) throw new Error('Member must have a team');

        const team = await Team.findById(user.team).session(session);
        if (!team) throw new Error('Team not found');
        if (team.isActive === false) throw new Error('Team is not active');
        if (team.department !== user.department) {
          throw new Error('Team department mismatch with user.department');
        }
        if (!team.lead) throw new Error('Team has no lead yet');

        // Синхронізуємо membership
        await removeUserFromAllTeamsMembers(user._id, session);
        await ensureUserMemberOfTeam(user.team, user._id, session);

        // member не має наставника (assistantOf), це лише для assistant
        user.assistantOf = null;

        // webId для не-MB очищаємо
        if (user.department !== 'Media Buying') user.webId = null;

      } else if (kind === 'assistant') {
        if (!user.assistantOf) throw new Error('Assistant must have assistantOf (supervisor)');

        const sup = await UserModel.findById(user.assistantOf).session(session);
        if (!sup) throw new Error('Supervisor not found');
        if (sup.department !== user.department) throw new Error('Dept mismatch with supervisor');
        if (!['lead', 'member'].includes(sup.teamRole)) {
          throw new Error('Supervisor must be lead or member');
        }
        if (!sup.team) throw new Error('Supervisor has no team');

        // Наслідуємо команду керівника
        user.team = sup.team;

        // Асистент є членом команди
        await removeUserFromAllTeamsMembers(user._id, session);
        await ensureUserMemberOfTeam(user.team, user._id, session);

        // webId не застосовується
        user.webId = null;

      } else {
        // teamRole = null → прибираємо усі привʼязки
        await removeUserFromAllTeamsMembers(user._id, session);
        user.team = null;
        user.assistantOf = null;
        user.webId = null;
      }
    }

    // Якщо користувач перестав бути лідом — приберемо його з lead у будь-яких командах (перестраховка)
    if (typeof p.teamRole !== 'undefined' && p.teamRole !== 'lead') {
      if (prevTeamId) {
        const t = await Team.findById(prevTeamId).session(session);
        if (t && String(t.lead) === String(user._id)) {
          t.lead = null;
          await t.save({ session });
        }
      }
      await Team.updateMany(
        { lead: user._id },
        { $set: { lead: null } },
        { session }
      );
    }

    // webId фінальна валідація (лише MB і лише lead/member)
    if ('webId' in p) {
      const canHaveWebId =
        user.department === 'Media Buying' &&
        (user.teamRole === 'lead' || user.teamRole === 'member');
      if (!canHaveWebId) {
        user.webId = null;
      }
    }

    await user.save({ session });
    await session.commitTransaction();
    session.endSession();
    return user;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = { patchUserRoles };
