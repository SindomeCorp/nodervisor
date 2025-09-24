
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const morgan = require('morgan');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const { ConnectSessionKnexStore } = require('connect-session-knex');
const stylus = require('stylus');
const errorhandler = require('errorhandler');
const Knex = require('knex');

const config = require('./config');
const schema = require('./sql/schema');
const supervisordapi = require('supervisord');

const app = express();

app.set('port', config.port);
app.set('host', config.host);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('env', config.env);

const db = Knex(config.db);
const knexsessions = Knex(config.sessionstore);

const sessionStore = new ConnectSessionKnexStore({
  knex: knexsessions,
  tablename: 'sessions',
  createTable: true
});

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
app.use(cookieParser());
app.use(
  session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
    store: sessionStore
  })
);
app.use(stylus.middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

if (app.get('env') === 'development') {
  app.use(errorhandler());
}

require('./routes')({
  app,
  config,
  supervisordapi,
  db
});

const start = async () => {
  try {
    await schema.create(db);
    await config.readHosts(db);
    app.listen(app.get('port'), app.get('host'), () => {
      console.log(
        `Nodervisor launched on ${app.get('host')}:${app.get('port')}`
      );
    });
  } catch (err) {
    console.error('Failed to start Nodervisor', err);
    process.exit(1);
  }
};

start();

module.exports = app;
