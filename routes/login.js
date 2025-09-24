/*
 * GET/POST login page
 */

const bcrypt = require('bcrypt');

exports.login = function(params) {
        return async function(req, res, next) {
                try {
                        if (req.session.loggedIn) {
                                return res.redirect('/');
                        }

                        if (req.body.submit !== undefined) {
                                const email = req.body.email;
                                const users = await params.db('users')
                                        .where('Email', email);

                                let error = 'Password failed';
                                const user = users[0];

                                if (user) {
                                        const passwordMatch = await bcrypt.compare(req.body.password, user.Password);
                                        if (passwordMatch) {
                                                req.session.loggedIn = true;
                                                req.session.user = user;
                                                return res.redirect('/');
                                        }
                                } else {
                                        error = 'Email not found';
                                }

                                req.session.loggedIn = false;
                                req.session.user = null;
                                return res.render('login', {
                                        title: 'Nodervisor - Login',
                                        error: error
                                });
                        }

                        return res.render('login', {
                                title: 'Nodervisor - Login',
                                session: req.session
                        });
                } catch (err) {
                        return next(err);
                }
        };
};
