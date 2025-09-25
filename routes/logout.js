/*
 * GET logout page
 */

export function logout() {
  return function (req, res, next) {
    req.session.destroy(function (err) {
      if (err) {
        return next(err);
      }
      res.clearCookie('connect.sid');
      return res.redirect('/');
    });
  };
}
