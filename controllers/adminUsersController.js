// controllers/adminUsersController.js
'use strict';

const mongoose = require('mongoose');
const { Types } = mongoose;
const User = require('../models/User');
const Team = require('../models/Team');
const enumsService = require('../services/enumsService');
const { SCOPES, getUserScopes } = require('../scripts/permissions/scopes');
const { getTeamRoleLabel } = require('../helpers/appHelper'); // moved helper here

// -------------------- helpers --------------------
function toObjectIdOrNull(v) {
  if (!v) return null;
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}

function getActorFlags(req, res) {
  if (res?.locals) {
    const isAdmin = !!res.locals.isAdmin;
    const isManager = !!res.locals.isManager && !isAdmin;
    return { isAdmin, isManager };
  }
  const user = req.session?.user || req.user || null;
  const set = new Set(getUserScopes(user));
  const isAdmin = set.has(SCOPES.INTEGRATIONS_ADMIN);
  const isManager = !isAdmin && set.has(SCOPES.TEAMS_WRITE_ANY);
  return { isAdmin, isManager };
}

async function loadEnumValues(department) {
  const [orgRoles, deptRolesByDept, teamRolesByDept] = await Promise.all([
    enumsService.getOrgRoleOptions(),
    enumsService.getDeptRoleOptionsByDept(department),
    enumsService.getTeamRoleOptionsByDept(department),
  ]);

  const ORG = {
    ADMIN: orgRoles.find(r => r.value === 'admin')?.value,
    MANAGER: orgRoles.find(r => r.value === 'manager')?.value,
    USER: orgRoles.find(r => r.value === 'user')?.value,
  };
  const DEPT = { HEAD: deptRolesByDept.find(r => r.value === 'head')?.value };
  const TEAM = {
    LEAD: teamRolesByDept.find(r => r.value === 'lead')?.value,
    MEMBER: teamRolesByDept.find(r => r.value === 'member')?.value,
    ASSISTANT: teamRolesByDept.find(r => r.value === 'assistant')?.value,
  };

  return { ORG, DEPT, TEAM, orgRoles, deptRolesByDept, teamRolesByDept };
}

function uiDeptToDb(deptRoleUI) { return deptRoleUI ? deptRoleUI : 'none'; }
function dbDeptToUi(deptRoleDB) { return (deptRoleDB && deptRoleDB !== 'none') ? deptRoleDB : null; }
function normalizeWebId(input) {
  if (input == null) return null;
  const digits = String(input).replace(/\D/g, '');
  return digits.length ? digits : null; // keep digits only; model enforces exact format
}

// -------------------- GET /admin/users/management --------------------
async function getManagementData(req, res, next) {
  try {
    const department = req.query.department || 'Media Buying';
    const { isAdmin, isManager } = getActorFlags(req, res);

    const { ORG, deptRolesByDept, teamRolesByDept, orgRoles } = await loadEnumValues(department);

    const usersQuery = { department };
    if (!isAdmin && isManager && ORG.ADMIN) {
      usersQuery.orgRole = { $ne: ORG.ADMIN }; // manager should not see admins
    }

    const rawUsers = await User.find(usersQuery)
      .select('_id firstName lastName email telegramUsername department orgRole deptRole teamRole team assistantOf webId isActive position')
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const users = rawUsers.map(u => ({
      _id: String(u._id),
      firstName: u.firstName || '',
      lastName: u.lastName || '',
      email: u.email || '',
      telegramUsername: u.telegramUsername || '',
      department: u.department || '',
      orgRole: u.orgRole || null,
      deptRole: dbDeptToUi(u.deptRole),
      teamRole: u.teamRole || null,
      team: u.team ? String(u.team) : null,
      assistantOf: u.assistantOf ? String(u.assistantOf) : null,
      webId: u.webId || null,
      isActive: !!u.isActive,
      position: u.position || null,
    }));

    const orgRolesForSelect = (!isAdmin && isManager && ORG.ADMIN)
      ? orgRoles.filter(r => r.value !== ORG.ADMIN)
      : orgRoles;

    const teams = await Team.find({ department, isActive: true })
      .select('_id name')
      .sort({ name: 1 })
      .lean();

    return res.json({
      department,
      users,
      options: {
        orgRoles: orgRolesForSelect,
        deptRolesByDept,
        teamRolesByDept,
        teams,
      },
    });
  } catch (e) { next(e); }
}

// -------------------- PATCH /admin/users/:id/roles --------------------
async function patchRoles(req, res, next) {
  try {
    const userId = req.params.id;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ ok: false, error: 'Invalid user id' });
    }

    // Only apply fields present in the payload
    const b = req.body || {};
    const has = (k) => Object.prototype.hasOwnProperty.call(b, k);

    const patch = {
      orgRole: (b.orgRole ?? b.orgrole),
      deptRole: (b.deptRole ?? b.deptrole),
      teamRole: (b.teamRole ?? b.teamrole),
      team: has('team') ? (b.team || null) : undefined,
      assistantOf: has('assistantOf') ? (b.assistantOf || null) : undefined,
      webId: has('webId') ? b.webId : (has('webID') ? b.webID : undefined),
    };

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found' });

    const { ORG, DEPT, TEAM } = await loadEnumValues(user.department);

    const { isAdmin, isManager } = getActorFlags(req, res);
    if (!isAdmin && isManager && typeof patch.orgRole !== 'undefined' && ORG.ADMIN && patch.orgRole === ORG.ADMIN) {
      return res.status(403).json({ ok: false, error: 'Forbidden', message: 'Manager cannot assign admin role' });
    }

    // ---- ORG ROLE (partial update)
    if (typeof patch.orgRole !== 'undefined' && patch.orgRole !== user.orgRole) {
      user.orgRole = patch.orgRole;
    }

    // If user becomes admin → clear dept/team fields and any leadership
    if (ORG.ADMIN && user.orgRole === ORG.ADMIN) {
      if (user.team) {
        await Team.updateOne({ _id: user.team, lead: user._id }, { $unset: { lead: 1 } }, { runValidators: false });
      }
      await Team.updateMany({ lead: user._id }, { $unset: { lead: 1 } }, { runValidators: false });

      user.deptRole = 'none';
      user.teamRole = null;
      user.team = null;
      user.assistantOf = null;
      user.webId = null;
      user.position = null;

      await user.save();
      return res.json({
        ok: true,
        user: {
          _id: String(user._id),
          department: user.department || '',
          orgRole: user.orgRole || null,
          deptRole: dbDeptToUi(user.deptRole),
          teamRole: user.teamRole || null,
          team: user.team ? String(user.team) : null,
          assistantOf: user.assistantOf ? String(user.assistantOf) : null,
          webId: user.webId || null,
          isActive: !!user.isActive,
          position: user.position || null,
          updatedAt: user.updatedAt
        },
      });
    }

    // ---- DEPT ROLE / TEAM ROLE / TEAM / ASSISTANTOF (partial updates)
    const prevTeamRole = user.teamRole; // snapshot before mutation
    const deptRoleUI = has('deptRole') ? patch.deptRole : dbDeptToUi(user.deptRole);
    const teamRoleNew = has('teamRole') ? patch.teamRole : user.teamRole;

    // Department head on/off
    if (DEPT.HEAD && deptRoleUI === DEPT.HEAD) {
      if (TEAM.LEAD && prevTeamRole === TEAM.LEAD) {
        await Team.updateMany({ lead: user._id }, { $unset: { lead: 1 } }, { runValidators: false });
      }
      user.deptRole = uiDeptToDb(DEPT.HEAD);
      user.teamRole = null;
      user.team = null;
      user.assistantOf = null;
      user.webId = null;

      try {
        const opts = await enumsService.getDeptRoleOptionsByDept(user.department);
        const headOpt = Array.isArray(opts) ? opts.find(o => o.value === DEPT.HEAD) : null;
        user.position = headOpt?.label || user.position || 'Head';
      } catch { user.position = user.position || 'Head'; }
    } else {
      if (has('deptRole')) {
        user.deptRole = uiDeptToDb(deptRoleUI); // null/'' → 'none'
        // Recompute position based on current teamRole if it exists; otherwise clear.
        if (user.teamRole) {
          const label = await getTeamRoleLabel(user.department, user.teamRole);
          user.position = label || null;
        } else {
          user.position = null;
        }
      }

      const teamRoleChanging = has('teamRole');

      // 1) teamRole change
      if (teamRoleChanging) {
        if (teamRoleNew && TEAM.LEAD && teamRoleNew === TEAM.LEAD) {
          const prevTeamId = user.team ? String(user.team) : null;
          user.teamRole = TEAM.LEAD;

          if (has('team') && patch.team) {
            const teamIdObj = toObjectIdOrNull(patch.team);
            if (!teamIdObj) return res.status(400).json({ ok: false, error: 'Invalid team' });

            const team = await Team.findById(teamIdObj);
            if (!team || team.department !== user.department) {
              return res.status(400).json({ ok: false, error: 'Invalid team for this department' });
            }

            const nextTeamId = String(team._id);
            user.team = team._id;

            if (!team.lead || String(team.lead) !== String(user._id)) {
              team.lead = user._id;
              await team.save();
            }
            if (prevTeamId && prevTeamId !== nextTeamId) {
              await Team.updateOne(
                { _id: prevTeamId, lead: user._id },
                { $unset: { lead: 1 } },
                { runValidators: false }
              );
            }
            user.assistantOf = null;
          } else {
            user.assistantOf = null;
          }

          // set position by TeamRole label
          user.position = (await getTeamRoleLabel(user.department, TEAM.LEAD)) || null;

        } else if (teamRoleNew && TEAM.MEMBER && teamRoleNew === TEAM.MEMBER) {
          user.teamRole = TEAM.MEMBER;

          if (has('team') && patch.team) {
            const teamIdObj = toObjectIdOrNull(patch.team);
            if (!teamIdObj) return res.status(400).json({ ok: false, error: 'Invalid team' });

            const team = await Team.findById(teamIdObj);
            if (!team || team.department !== user.department) {
              return res.status(400).json({ ok: false, error: 'Invalid team for this department' });
            }
            user.team = team._id;
          }

          // set position by TeamRole label
          user.position = (await getTeamRoleLabel(user.department, TEAM.MEMBER)) || null;

        } else if (teamRoleNew && TEAM.ASSISTANT && teamRoleNew === TEAM.ASSISTANT) {
          user.teamRole = TEAM.ASSISTANT;

          if (has('assistantOf') && patch.assistantOf) {
            const supIdObj = toObjectIdOrNull(patch.assistantOf);
            if (!supIdObj) return res.status(400).json({ ok: false, error: 'Invalid assistantOf' });

            const sup = await User.findById(supIdObj).lean();
            if (!sup || sup.department !== user.department || !sup.team) {
              return res.status(400).json({ ok: false, error: 'Invalid supervisor (assistantOf)' });
            }
            if (![TEAM.LEAD, TEAM.MEMBER].includes(sup.teamRole)) {
              return res.status(400).json({ ok: false, error: 'Invalid supervisor role' });
            }
            user.assistantOf = sup._id;
            user.team = sup.team;
          } else {
            user.assistantOf = null;
            user.team = null;
          }
          user.webId = null;

          // set position by TeamRole label
          user.position = (await getTeamRoleLabel(user.department, TEAM.ASSISTANT)) || null;

        } else {
          // teamRole = null
          if (TEAM.LEAD && user.teamRole === TEAM.LEAD) {
            await Team.updateMany({ lead: user._id }, { $unset: { lead: 1 } }, { runValidators: false });
          }
          user.teamRole = null;
          user.team = null;
          user.assistantOf = null;
          user.position = null; // clear position when no team role and not head
        }
      }

      // 2) change team only (for LEAD/MEMBER)
      if (!teamRoleChanging && has('team') &&
        user.teamRole && [TEAM.LEAD, TEAM.MEMBER].includes(user.teamRole)) {

        const prevTeamId = user.team ? String(user.team) : null;

        const teamIdObj = toObjectIdOrNull(patch.team);
        if (patch.team && !teamIdObj) {
          return res.status(400).json({ ok: false, error: 'Invalid team' });
        }

        if (teamIdObj) {
          const team = await Team.findById(teamIdObj);
          if (!team || team.department !== user.department) {
            return res.status(400).json({ ok: false, error: 'Invalid team for this department' });
          }

          const nextTeamId = String(team._id);
          user.team = team._id;

          if (user.teamRole === TEAM.LEAD) {
            if (!team.lead || String(team.lead) !== String(user._id)) {
              team.lead = user._id;
              await team.save();
            }
            if (prevTeamId && prevTeamId !== nextTeamId) {
              await Team.updateOne(
                { _id: prevTeamId, lead: user._id },
                { $unset: { lead: 1 } },
                { runValidators: false }
              );
            }
            user.assistantOf = null;
          }
          // position stays as role-based label
        } else {
          // "not selected" for team
          if (user.teamRole === TEAM.LEAD && prevTeamId) {
            await Team.updateOne(
              { _id: prevTeamId, lead: user._id },
              { $unset: { lead: 1 } },
              { runValidators: false }
            );
          } else {
            await Team.updateMany(
              { lead: user._id },
              { $unset: { lead: 1 } },
              { runValidators: false }
            );
          }
          user.team = null;
        }
      }

      // 3) change assistantOf only (for ASSISTANT)
      if (!teamRoleChanging && has('assistantOf') && user.teamRole === TEAM.ASSISTANT) {
        const supIdObj = toObjectIdOrNull(patch.assistantOf);
        if (patch.assistantOf && !supIdObj) {
          return res.status(400).json({ ok: false, error: 'Invalid assistantOf' });
        }

        if (supIdObj) {
          const sup = await User.findById(supIdObj).lean();
          if (!sup || sup.department !== user.department || !sup.team) {
            return res.status(400).json({ ok: false, error: 'Invalid supervisor (assistantOf)' });
          }
          if (![TEAM.LEAD, TEAM.MEMBER].includes(sup.teamRole)) {
            return res.status(400).json({ ok: false, error: 'Invalid supervisor role' });
          }
          user.assistantOf = sup._id;
          user.team = sup.team;
          // position remains assistant's label
        } else {
          user.assistantOf = null;
          user.team = null;
          // position remains assistant's label
        }
      }
    }

    // --- webId (Media Buying only, for LEAD/MEMBER). Does not touch team/assistantOf.
    if (typeof patch.webId !== 'undefined') {
      const canHaveWebId =
        user.department === 'Media Buying' &&
        user.teamRole && [TEAM.LEAD, TEAM.MEMBER].includes(user.teamRole);

      user.webId = canHaveWebId ? normalizeWebId(patch.webId) : null;
    }

    await user.save();

    return res.json({
      ok: true,
      user: {
        _id: String(user._id),
        department: user.department || '',
        orgRole: user.orgRole || null,
        deptRole: dbDeptToUi(user.deptRole),
        teamRole: user.teamRole || null,
        team: user.team ? String(user.team) : null,
        assistantOf: user.assistantOf ? String(user.assistantOf) : null,
        webId: user.webId || null,
        isActive: !!user.isActive,
        position: user.position || null,
        updatedAt: user.updatedAt
      },
    });
  } catch (e) {
    console.error('[PATCH /admin/users/:id/roles] unhandled:', e);
    return res.status(500).json({ ok: false, error: 'InternalError', message: e?.message });
  }
}

module.exports = { getManagementData, patchRoles };
