/*
 * GET/POST settings page
 */

const bcrypt = require('bcrypt');

exports.users = function(params) {
        return async function(req, res, next) {
                if (!req.session.loggedIn) {
                        return res.redirect('/login');
                }

                if (req.session.user.Role != 'Admin') {
                        return res.redirect('/dashboard');
                }

                try {
                        if (req.body.delete !== undefined && req.params.idUser) {
                                await params.db('users')
                                        .where('id', req.params.idUser)
                                        .del();
                                return res.redirect('/users');
                        }

                        if (req.body.submit !== undefined && req.params.idUser) {
                                if (req.params.idUser === 'new') {
                                        const hashedPassword = await bcrypt.hash(req.body.password, 10);
                                        await params.db('users').insert({
                                                Name: req.body.name,
                                                Email: req.body.email,
                                                Password: hashedPassword,
                                                Role: req.body.role
                                        });
                                } else {
                                        const info = {
                                                Name: req.body.name,
                                                Email: req.body.email,
                                                Role: req.body.role
                                        };

                                        if (req.body.password !== '') {
                                                info.Password = await bcrypt.hash(req.body.password, 10);
                                        }

                                        await params.db('users')
                                                .where('id', req.params.idUser)
                                                .update(info);
                                }

                                return res.redirect('/users');
                        }

                        if (req.params.idUser) {
                                if (req.params.idUser === 'new') {
                                        return res.render('edit_user', {
                                                title: 'Nodervisor - Edit User',
                                                user: null,
                                                session: req.session
                                        });
                                }

                                const user = await params.db('users')
                                        .where('id', req.params.idUser)
                                        .first();

                                if (!user) {
                                        return res.redirect('/users');
                                }

                                return res.render('edit_user', {
                                        title: 'Nodervisor - Edit User',
                                        user: user,
                                        session: req.session
                                });
                        }

                        const users = await params.db('users');

                        return res.render('users', {
                                title: 'Nodervisor - Users',
                                users: users,
                                session: req.session
                        });
                } catch (err) {
                        return next(err);
                }
        };
};
