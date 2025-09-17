'use strict';

function sameDepartment(a, b) {
  return a?.department && b?.department && String(a.department) === String(b.department);
}
function isTeamLeadOf(user, team) {
  if (!user?.teamRole || user.teamRole !== 'lead') return false;
  if (!user?.team || !team?._id) return false;
  return String(user.team) === String(team._id);
}
function isSelf(user, targetId) {
  return String(user?._id || user?.id) === String(targetId);
}
function inSameTeam(a, b) {
  return a?.team && b?.team && String(a.team) === String(b.team);
}

module.exports = { sameDepartment, isTeamLeadOf, isSelf, inSameTeam };
