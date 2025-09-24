/*
 * GET downloadctl page.
 */

exports.ajax_supervisorlog = function(params) {
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
                var offset = parseInt(req.query.offset, 10);
                if (isNaN(offset) || offset < 0) {
                        offset = 0;
                }
                var length = 16384;

                if (!host || !process) {
                        return res.status(400).json({result: 'error', message: 'Host and process are required'});
                }

                if (config.hosts[host] !== undefined) {
                        var supclient = supervisordapi.connect(config.hosts[host].Url);

                        switch (req.query.type) {
                                case 'out': {
                                        if (offset === 0) {
                                                // If we dont know the offset to start, lets do two calls to fetch the current logsize and then offset
                                                supclient.tailProcessStdoutLog(process, 0, 0, function(err, data){
                                                        if (!err) {
                                                                offset = Math.max(data[1] - length, 0);
                                                                supclient.tailProcessStdoutLog(process, offset, length, function(err, data){
                                                                        res.json({result: 'success', data: data});
                                                                });
                                                        } else {
                                                                return res.status(500).json({result: 'error', error: err});
                                                        }
                                                });
                                        } else {
                                                supclient.tailProcessStdoutLog(process, offset, length, function(err, data){
                                                        if (!err) {
                                                                // For some reason it doesnt use the length properly, so trim it to expected length now
                                                                length = Math.max(data[1] - offset, 0);
                                                                var log = data[0];
                                                                data[0] = log.substr(length * -1);
                                                                res.json({result: 'success', data: data});
                                                        } else {
                                                                return res.status(500).json({result: 'error', error: err});
                                                        }
                                                });
                                        }
                                }
                                break;
                                case 'err': {
                                                if (offset === 0) {
                                                        supclient.tailProcessStderrLog(process, 0, 0, function(err, data){
                                                                if (!err) {
                                                                        // If we dont know the offset to start, lets do two calls to fetch the current logsize and then offset
                                                                        offset = Math.max(data[1] - length, 0);
                                                                        supclient.tailProcessStderrLog(process, offset, length, function(err, data){
                                                                                res.json({result: 'success', data: data});
                                                                        });
                                                                } else {
                                                                        return res.status(500).json({result: 'error', error: err});
                                                                }

                                                        });
                                                } else {
                                                        supclient.tailProcessStderrLog(process, offset, length, function(err, data){
                                                                if (!err) {
                                                                        // For some reason it doesnt use the length properly, so trim it to expected length now
                                                                        length = Math.max(data[1] - offset, 0);
                                                                        var log = data[0];
                                                                        data[0] = log.substr(length * -1);
                                                                        res.json({result: 'success', data: data});
                                                                } else {
                                                                return res.status(500).json({result: 'error', error: err});
                                                        }
                                                });
                                        }
                                }
                                break;
                                case 'clear': {
                                                supclient.clearProcessLogs(process, function(){
                                                                return res.json({result: 'success', data: ["", 0, false]});
                                                });
                                }
                                break;
                                default:
                                        return res.status(400).json({result: 'error', message: 'Unknown log type'});
                                }
                } else {
                        return res.status(404).json({result: 'error', message: 'Host not found'});
                }
        };
};
