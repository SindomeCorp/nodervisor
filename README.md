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

  3. Log in using the default credentials of:
  	<ul>
  		<li>Email: admin@nodervisor</li>
  		<li>Password: admin</li>
	</ul>

  4. Navigate to the users page using the top menu. Change the admin credentials or add a new user and remove them.

  5. Navigate to the hosts page using the top menu. Then add a host running supervisord using the form. Your supervisord config on each host should be set up to allow the xmlrpc interface over a inet port.
  For instance:

      [inet_http_server]
      port = *:9009 ;

  At this point, navigating back to the home page should show you a list of your hosts, and the processes running on them.

### Screenshots

  ![List of hosts with summary](/../screenshots/screenshots/screenshot1.png?raw=true "List of hosts with summary")
  ![Dashboard view with groups](/../screenshots/screenshots/screenshot2.png?raw=true "Dashboard view with groups")
  ![View logs directly](/../screenshots/screenshots/screenshot3.png?raw=true "View logs directly")
