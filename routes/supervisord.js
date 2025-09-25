/*
 * GET supervisord page
 */

export function supervisord() {
  return function (req, res) {
    if (!req.session.loggedIn) {
      return res.redirect('/login');
    }

    if (req.session.user.Role !== 'Admin') {
      return res.redirect('/dashboard');
    }

    return res.render('supervisord', {
      title: 'Nodervisor - All Hosts',
      session: req.session
    });
  };
}
