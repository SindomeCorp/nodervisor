const DEFAULT_EMAIL = 'admin@nodervisor';
const DEFAULT_NAME = 'Admin';

function resolveAdminCredentials() {
  const email = process.env.ADMIN_SEED_EMAIL?.trim() || DEFAULT_EMAIL;
  const passwordHash = process.env.ADMIN_SEED_PASSWORD_HASH?.trim();
  const password = process.env.ADMIN_SEED_PASSWORD?.trim();

  if (passwordHash) {
    return { email, passwordHash };
  }

  if (!password) {
    throw new Error(
      'Set ADMIN_SEED_PASSWORD (plain text) or ADMIN_SEED_PASSWORD_HASH (bcrypt hash) before running the admin seed.'
    );
  }

  return { email, password };
}

async function hashPasswordIfNeeded(credentials) {
  if (credentials.passwordHash) {
    return credentials.passwordHash;
  }

  const bcrypt = await import('bcrypt');
  const saltRounds = Number(process.env.ADMIN_SEED_SALT_ROUNDS ?? 12);

  if (!Number.isFinite(saltRounds) || saltRounds < 4) {
    throw new Error('ADMIN_SEED_SALT_ROUNDS must be an integer >= 4 when provided.');
  }

  const hash = bcrypt.hash ?? bcrypt.default?.hash;

  if (typeof hash !== 'function') {
    throw new Error('Unable to load bcrypt hashing implementation.');
  }

  return hash(credentials.password, saltRounds);
}

/**
 * @param {import('knex')} knex
 */
exports.seed = async function seed(knex) {
  const credentials = resolveAdminCredentials();
  const existingAdmin = await knex('users').where('Email', credentials.email).first();

  if (existingAdmin) {
    return;
  }

  const passwordHash = await hashPasswordIfNeeded(credentials);

  await knex('users').insert({
    Name: DEFAULT_NAME,
    Email: credentials.email,
    Password: passwordHash,
    Role: 'Admin'
  });
};
