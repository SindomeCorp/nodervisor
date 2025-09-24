/*
 * GET supervisords json data
 */

const async = require('async');

exports.ajax_supervisord = function(params) {
        var config = params.config;
        var supervisordapi = params.supervisordapi;
        return function(req, res) {

                if (!req.session.loggedIn) {
                        return res.status(401).json({error: 'Not logged in'});
                }

                var supervisords = {};
                var hosts = [];
                for (var idHost in config.hosts) {
                        hosts.push(config.hosts[idHost]);
                }

                async.each(hosts, function(host, callback){
                        var supclient = supervisordapi.connect(host.Url);
                        supclient.getAllProcessInfo(function(err, result){
                                if (err === null) {
                                        supervisords[host.idHost] = {
                                                host: host,
                                                data: result
                                        };
                                } else {
                                        supervisords[host.idHost] = {
                                                host: host,
                                                data: err
                                        };
                                }
                                return callback();
                        });
                }, function(){
                        res.json(supervisords);
                });
        };
};
