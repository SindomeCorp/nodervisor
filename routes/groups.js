/*
 * GET/POST groups page
 */

exports.groups = function(params) {
        return async function(req, res, next) {
                if (!req.session.loggedIn) {
                        return res.redirect('/login');
                }
                if (req.session.user.Role != 'Admin') {
                        return res.redirect('/dashboard');
                }

                try {
                        if (req.body.delete !== undefined && req.params.idGroup) {
                                await params.db('groups')
                                        .where('idGroup', req.params.idGroup)
                                        .del();
                                await params.config.readHosts(params.db);
                                return res.redirect('/groups');
                        } else if (req.body.submit !== undefined && req.params.idGroup) {
                                if (req.params.idGroup === 'new') {
                                        await params.db('groups').insert({
                                                Name: req.body.name
                                        });
                                } else {
                                        await params.db('groups')
                                                .where('idGroup', req.params.idGroup)
                                                .update({
                                                        Name: req.body.name
                                                });
                                }
                                await params.config.readHosts(params.db);
                                return res.redirect('/groups');
                        }

                        if (req.params.idGroup) {
                                if (req.params.idGroup === 'new') {
                                        return res.render('edit_group', {
                                                title: 'Nodervisor - Edit Group',
                                                group: null,
                                                session: req.session
                                        });
                                }

                                const group = await params.db('groups')
                                        .where('idGroup', req.params.idGroup)
                                        .first();

                                if (!group) {
                                        return res.redirect('/groups');
                                }

                                return res.render('edit_group', {
                                        title: 'Nodervisor - Edit Group',
                                        group: group,
                                        session: req.session
                                });
                        }

                        const groups = await params.db('groups');
                        return res.render('groups', {
                                title: 'Nodervisor - Groups',
                                groups: groups,
                                session: req.session
                        });
                } catch (err) {
                        return next(err);
                }
        };
};
