/*
 * GET/POST hosts page
 */

export function hosts(params) {
  const { db, config } = params;
  return async function (req, res, next) {
    if (!req.session.loggedIn) {
      return res.redirect('/login');
    }
    if (req.session.user.Role !== 'Admin') {
      return res.redirect('/dashboard');
    }

    try {
      if (req.body.delete !== undefined && req.params.idHost) {
        await db('hosts').where('idHost', req.params.idHost).del();
        await config.readHosts(db);
        return res.redirect('/hosts');
      }
      if (req.body.submit !== undefined && req.params.idHost) {
        const rawGroup = req.body.group;
        const parsedGroup = rawGroup && rawGroup !== 'null' ? Number(rawGroup) : null;
        const groupId = Number.isNaN(parsedGroup) ? null : parsedGroup;

        if (req.params.idHost === 'new') {
          await db('hosts').insert({
            Name: req.body.name,
            Url: req.body.url,
            idGroup: groupId
          });
        } else {
          await db('hosts')
            .where('idHost', req.params.idHost)
            .update({
              Name: req.body.name,
              Url: req.body.url,
              idGroup: groupId
            });
        }

        await config.readHosts(db);
        return res.redirect('/hosts');
      }

      if (req.params.idHost) {
        if (req.params.idHost === 'new') {
          const groups = await db('groups').select('idGroup', 'Name');
          return res.render('edit_host', {
            title: 'Nodervisor - New Host',
            host: null,
            groups,
            session: req.session
          });
        }

        const host = await db('hosts')
          .where('idHost', req.params.idHost)
          .first();

        if (!host) {
          return res.redirect('/hosts');
        }

        const groups = await db('groups').select('idGroup', 'Name');
        return res.render('edit_host', {
          title: 'Nodervisor - Edit Host',
          host,
          groups,
          session: req.session
        });
      }

      const hosts = await db('hosts')
        .leftJoin('groups', 'hosts.idGroup', 'groups.idGroup')
        .select('hosts.idHost', 'hosts.Name', 'hosts.Url', 'groups.Name AS GroupName');

      return res.render('hosts', {
        title: 'Nodervisor - Hosts',
        hosts,
        session: req.session
      });
    } catch (err) {
      return next(err);
    }
  };
}
