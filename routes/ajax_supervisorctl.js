/*
 * GET downloadctl page.
 */

exports.ajax_supervisorctl = function(params) {
	var config = params.config;
	var supervisordapi = params.supervisordapi;

        return function(req, res) {

                if (!req.session.loggedIn) {
                        return res.status(401).json({error: 'Not logged in'});
                }

                if (req.session.user.Role != 'Admin') {
                        return res.status(403).json({error: 'Incorrect Priviledges!'});
                }

                var host = req.query.host;
                var process = req.query.process;
                var action = req.query.action;

                if (!host) {
                        return res.status(400).json({result: 'error', message: 'Host is required'});
                }

                if (!action) {
                        return res.status(400).json({result: 'error', message: 'Action is required'});
                }

                if (action !== 'restartAll' && !process) {
                        return res.status(400).json({result: 'error', message: 'Process is required'});
                }

                if (config.hosts[host] !== undefined) {
                        var supclient = supervisordapi.connect(config.hosts[host].Url);
                        switch (action) {
                                case 'stop': {
                                        supclient.stopProcess(process, function(){
                                                return res.json({result: 'success'});
                                        });
                                }
                                break;
                                case 'start': {
                                        supclient.startProcess(process, function(){
                                                return res.json({result: 'success'});
                                        });
                                }
                                break;
                                case 'restart': {
                                        supclient.stopProcess(process, function(){
                                                supclient.startProcess(process, function(){
                                                        return res.json({result: 'success'});
                                                });
                                        });
                                }
                                break;
                                case 'restartAll': {
                                        supclient.stopAllProcesses(true, function(){
                                                supclient.startAllProcesses(true, function(){
                                                        return res.json({result: 'success'});
                                                });
                                        });
                                }
                                break;
                                default:
                                        return res.status(400).json({result: 'error', message: 'Unknown action'});
                        }
                } else {
                        return res.status(404).json({result: 'error', message: 'Host not found'});
                }
        };
};
