/*
 * GET supervisords json data
 */

import async from 'async';

export function ajax_supervisord(params) {
  const { config, supervisordapi } = params;
  return function (req, res) {
    if (!req.session.loggedIn) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const supervisords = {};
    const hosts = Object.values(config.hosts);

    async.each(
      hosts,
      function (host, callback) {
        const supclient = supervisordapi.connect(host.Url);
        supclient.getAllProcessInfo(function (err, result) {
          if (err === null) {
            supervisords[host.idHost] = {
              host,
              data: result
            };
          } else {
            supervisords[host.idHost] = {
              host,
              data: err
            };
          }
          return callback();
        });
      },
      function () {
        res.json(supervisords);
      }
    );
  };
}
