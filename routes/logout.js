/*
 * GET logout page
 */

exports.logout = function() {
        return function(req, res, next) {
                req.session.destroy(function(err) {
                        if (err) {
                                return next(err);
                        }
                        res.clearCookie('connect.sid');
                        return res.redirect('/');
                });
        };
};
