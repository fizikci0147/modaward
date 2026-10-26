/**
 * Who may use Track Weight (/trackweight and /api/trackweight).
 *
 * By default only approved members: accounts an admin has added (Business → Track Weight), plus the
 * admins themselves. TRACKWEIGHT_ACCESS=open lets everyone in again.
 *
 * state() says why a person is let in or kept out, so the page and the API can answer precisely:
 *   'open'    access is open to everyone
 *   'member'  an approved member or an admin
 *   'signin'  members-only, and nobody is signed in
 *   'pending' members-only, signed in, but this account has not been approved
 */
export function createTrackweightAccess({ config, repos }) {
  const isAdmin = (user) => Boolean(user) && config.adminEmails.includes(String(user.email).toLowerCase());
  const state = (user) => {
    if (config.trackweight.access === 'open') return 'open';
    if (!user) return 'signin';
    return isAdmin(user) || repos.trackweight.isMember(user.id) ? 'member' : 'pending';
  };
  return {
    mode: config.trackweight.access,
    state,
    allows: (user) => ['open', 'member'].includes(state(user)),
    isAdmin
  };
}
