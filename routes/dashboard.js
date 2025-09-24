/*
 * GET supervisord page
 */

exports.dashboard = function(params) {
        return function(req, res) {

                if (!req.session.loggedIn) {
                        return res.redirect('/login');
                }

                return res.render('dashboard', {
                        title: 'Nodervisor - Dashboard',
                        session: req.session
                });
        };
};
