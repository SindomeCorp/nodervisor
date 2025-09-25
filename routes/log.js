/*
 * GET log page
 */

export function log(params) {
  const { config } = params;
  return function (req, res) {
    if (!req.session.loggedIn) {
      return res.redirect('/login');
    }

    if (req.session.user.Role !== 'Admin') {
      return res.redirect('/dashboard');
    }

    if (req.params.host && req.params.process) {
      const data = {};
      if (config.hosts[req.params.host] !== undefined) {
        data.host = config.hosts[req.params.host];
      } else {
        data.error = 'Host not found';
      }

      return res.render('log', {
        title: 'Nodervisor - Log',
        session: req.session,
        data,
        host: req.params.host,
        process: req.params.process,
        type: req.params.type
      });
    }
    return res.redirect('/');
  };
}
