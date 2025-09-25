/*
 * GET logout page
 */

/** @typedef {import('../server/types.js').ServerContext} ServerContext */

/**
 * @param {ServerContext} _context
 * @returns {import('../server/types.js').RequestHandler}
 */
export function logout(_context) {
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
