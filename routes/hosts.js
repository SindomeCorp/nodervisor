/*
 * GET/POST hosts page
 */

exports.hosts = function(params) {
        return async function(req, res, next) {

                if (!req.session.loggedIn) {
                        return res.redirect('/login');
                }
                if (req.session.user.Role != 'Admin') {
                        return res.redirect('/dashboard');
                }

                try {
                        if (req.body.delete !== undefined && req.params.idHost) {
                                await params.db('hosts')
                                        .where('idHost', req.params.idHost)
                                        .del();
                                await params.config.readHosts(params.db);
                                return res.redirect('/hosts');
                        } else if (req.body.submit !== undefined && req.params.idHost) {
                                const rawGroup = req.body.group;
                                const parsedGroup = rawGroup && rawGroup !== 'null' ? Number(rawGroup) : null;
                                const groupId = Number.isNaN(parsedGroup) ? null : parsedGroup;

                                if (req.params.idHost === 'new') {
                                        await params.db('hosts').insert({
                                                Name: req.body.name,
                                                Url: req.body.url,
                                                idGroup: groupId
                                        });
                                } else {
                                        await params.db('hosts')
                                                .where('idHost', req.params.idHost)
                                                .update({
                                                        Name: req.body.name,
                                                        Url: req.body.url,
                                                        idGroup: groupId
                                                });
                                }

                                await params.config.readHosts(params.db);
                                return res.redirect('/hosts');
                        }

                        if (req.params.idHost) {
                                if (req.params.idHost === 'new') {
                                        const groups = await params.db('groups').select('idGroup', 'Name');
                                        return res.render('edit_host', {
                                                title: 'Nodervisor - New Host',
                                                host: null,
                                                groups: groups,
                                                session: req.session
                                        });
                                }

                                const host = await params.db('hosts')
                                        .where('idHost', req.params.idHost)
                                        .first();

                                if (!host) {
                                        return res.redirect('/hosts');
                                }

                                const groups = await params.db('groups').select('idGroup', 'Name');
                                return res.render('edit_host', {
                                        title: 'Nodervisor - Edit Host',
                                        host: host,
                                        groups: groups,
                                        session: req.session
                                });
                        }

                        const hosts = await params.db('hosts')
                                .leftJoin('groups', 'hosts.idGroup', 'groups.idGroup')
                                .select('hosts.idHost', 'hosts.Name', 'hosts.Url', 'groups.Name AS GroupName');

                        return res.render('hosts', {
                                title: 'Nodervisor - Hosts',
                                hosts: hosts,
                                session: req.session
                        });
                } catch (err) {
                        return next(err);
                }
        };
};
