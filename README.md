nodervisor
==========

A Supervisord manager in node.js. Nodervisor provides a real-time web dashboard for processes running under [supervisord](http://supervisord.org/) across multiple hosts. You can stop and start individual processes, restart all the processes on a host, view logs for a process in real-time, and put a dashboard up for a quick overall summary of your services.

### Requirements

- Node.js 22 or newer
- Supervisord
- NPM

### Installation

  1. Clone the git repository into a folder and run:

        npm install

  2. Copy `.env-example` to `.env` (or set equivalent environment variables) and update the values for your database, session, and server configuration. For example:

        cp .env-example .env
        PORT=3000
        HOST=127.0.0.1
        DB_CLIENT=sqlite3
        DB_FILENAME=./nodervisor.sqlite
        SESSION_SECRET=use-a-long-random-string

     Before seeding the database you must also configure credentials for the bootstrap administrator account. Provide either a plain-text password (it will be hashed during the seed) or a pre-computed bcrypt hash:

        ADMIN_SEED_PASSWORD=change-me-soon
        # or provide a hash instead of plain text
        # ADMIN_SEED_PASSWORD_HASH=$2b$12$...

     To disable public account creation, set `AUTH_ALLOW_SELF_REGISTRATION=false`. Leaving the flag enabled allows anyone who
     can reach the login screen to create a low-privilege account, which may still reveal operational details such as host
     names and process states.

  3. Run the database migrations and seed data:

        npm run migrate
        npm run seed

### Database configuration

Nodervisor uses [Knex](https://knexjs.org/) for database access. The default configuration relies on SQLite, but MySQL (via the [`mysql2`](https://www.npmjs.com/package/mysql2) driver) and PostgreSQL (via [`pg`](https://www.npmjs.com/package/pg)) are also supported. Select a database by setting `DB_CLIENT` and the related connection settings in your environment:

```
# SQLite (default)
DB_CLIENT=sqlite3
DB_FILENAME=./nodervisor.sqlite

# MySQL
DB_CLIENT=mysql2
DB_HOST=localhost
DB_PORT=3306
DB_NAME=nodervisor
DB_USER=root
DB_PASSWORD=root

# PostgreSQL
DB_CLIENT=pg
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nodervisor
DB_USER=postgres
DB_PASSWORD=postgres
```

The session store uses the same connection details by default, but you can override it with the `SESSION_DB_*` variables when needed.

### How to use it

  Run the app using:

    npm start

  2. After the app has started, navigate to the machine in a browser on port 3000.
  For instance:
    http://localhost:3000

  3. Log in using the administrator credentials you configured via `ADMIN_SEED_PASSWORD`/`ADMIN_SEED_PASSWORD_HASH`. The default email is `admin@nodervisor`, but you can override it with `ADMIN_SEED_EMAIL` when seeding.

  4. Navigate to the users page using the top menu. Change the admin credentials or add a new user and remove them.

  5. Navigate to the hosts page using the top menu. Then add a host running supervisord using the form. Your supervisord config on each host should be set up to allow the xmlrpc interface over a inet port.
  For instance:

      [inet_http_server]
      port = *:9009 ;

  At this point, navigating back to the home page should show you a list of your hosts, and the processes running on them.

### Running behind an Apache reverse proxy

The Nodervisor server listens on port `3000` by default. To expose it securely behind Apache you can configure a reverse proxy. The steps below assume an Ubuntu/Debian host, but the same directives work on other distributions.

1. **Enable the required Apache modules** (if they are not already enabled):

       sudo a2enmod proxy proxy_http ssl headers
       sudo systemctl reload apache2

2. **Choose a TLS certificate option:**

   - **Self-signed certificate for testing:**

         sudo mkdir -p /etc/apache2/ssl
         sudo openssl req -x509 -nodes -days 365 \
           -newkey rsa:2048 \
           -keyout /etc/apache2/ssl/nodervisor.key \
           -out /etc/apache2/ssl/nodervisor.crt \
           -subj "/CN=example.com"

   - **Let's Encrypt certificate (recommended for production):**

         sudo apt install certbot python3-certbot-apache
         sudo certbot --apache -d example.com -d www.example.com

     Certbot writes the certificate and key to `/etc/letsencrypt/live/<domain>/` and can automatically renew them. If you prefer to manage the Apache configuration manually, use `certbot certonly --apache` and point the virtual host to the generated files.

3. **Create an Apache site configuration** pointing to the Nodervisor process running on port `3000`. Adjust the domain name and certificate paths to match your environment:

   ```apacheconf
   <VirtualHost *:80>
       ServerName example.com
       ServerAlias www.example.com

       RewriteEngine On
       RewriteCond %{HTTPS} !=on
       RewriteRule ^/?(.*) https://%{SERVER_NAME}/$1 [R=301,L]
   </VirtualHost>

   <IfModule mod_ssl.c>
   <VirtualHost *:443>
       ServerName example.com
       ServerAlias www.example.com

       SSLEngine on
       SSLCertificateFile /etc/letsencrypt/live/example.com/fullchain.pem
       SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem

       ProxyPreserveHost On
       ProxyPass / http://127.0.0.1:3000/
       ProxyPassReverse / http://127.0.0.1:3000/

       RequestHeader set X-Forwarded-Proto "https"
       RequestHeader set X-Forwarded-Port "443"

       ErrorLog ${APACHE_LOG_DIR}/nodervisor-error.log
       CustomLog ${APACHE_LOG_DIR}/nodervisor-access.log combined
   </VirtualHost>
   </IfModule>
   ```

4. **Enable the site and reload Apache:**

       sudo a2ensite nodervisor.conf
       sudo systemctl reload apache2

After reloading, Apache serves Nodervisor via HTTPS while forwarding requests to the Node.js server on port `3000`. Remember to keep your certificates renewed (Certbot installs a systemd timer by default) and adjust firewall rules to allow traffic on ports 80 and 443.

#### Configure Nodervisor to trust the proxy

When Nodervisor runs behind a reverse proxy it must trust the forwarded headers in order to detect HTTPS sessions and set secure cookies correctly. Configure this by setting the `TRUST_PROXY` environment variable before starting the server:

```
TRUST_PROXY=1
```

The value `1` tells Express to trust the first proxy hop, which is appropriate when Apache or Nginx is the only proxy in front of Nodervisor. If your traffic flows through multiple proxies (for example, a load balancer in front of Nginx), set `TRUST_PROXY` to the number of hops (any non-negative integer works) or use a textual boolean such as `TRUST_PROXY=true` or `TRUST_PROXY=on` to trust all proxies. Leave the variable unset (or set it to `false`, `no`, or `off`) when clients connect directly without a reverse proxy.

### Styling the dashboard

The React dashboard is bundled with Vite and no longer relies on the legacy assets that previously lived under `public/css`. Styling is split into a small design system and component-scoped CSS modules:

- `client/src/styles/tokens.css` defines the shared color palette, spacing scale, and typography tokens. It is imported once from `client/src/main.jsx` so the variables are available everywhere.
- `client/src/styles/ui.module.css` implements reusable primitives (buttons, tables, alerts, forms, etc.). Import the module into a component and compose the exported class names to keep pages consistent.
- Layout-specific rules live next to their React components (for example, `AppLayout.module.css` and `Dashboard.module.css`).

When adding new UI, prefer composing existing primitives from `ui.module.css`. If you need new global tokens, add them to `tokens.css`; if you need new reusable primitives, extend `ui.module.css`. Running `npm run dev:dashboard` will rebuild CSS automatically as you edit.

### Screenshots

  ![List of hosts with summary](/../screenshots/screenshots/screenshot1.png?raw=true "List of hosts with summary")
  ![Dashboard view with groups](/../screenshots/screenshots/screenshot2.png?raw=true "Dashboard view with groups")
  ![View logs directly](/../screenshots/screenshots/screenshot3.png?raw=true "View logs directly")
