// app.js
'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const createError = require('http-errors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const MongoStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const logger = require('morgan');
require('dotenv').config();

const dbHelper = require('./helpers/dbHelper');
const varMiddleware = require('./middleware/variables');

// Routes
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const usersRouter = require('./routes/users');
const dashboardRouter = require('./routes/dashboard');
const documentationRouter = require('./routes/documentation');
const botStatisticsRouter = require('./routes/botstatistics');
const pwaStatisticsRouter = require('./routes/pwastatistics');
const statisticsRouter = require('./routes/statistics');
const downloadRouter = require('./routes/download');
const buyingTeamRouter = require('./routes/buying-team');

// DB
const { MONGODB_URI, SESSION_SECRET, COOKIE_AGE } = process.env;
dbHelper.dbConnect(MONGODB_URI);

const app = express();
const store = new MongoStore({ collection: 'sessions', uri: MONGODB_URI });

// views
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// middlewares (base)
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// app.use(helmet()); // вмикай коли потрібно

// session + flash
app.use(session({
  secret: SESSION_SECRET,
  resave: true,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * Number(COOKIE_AGE || 24) },
  store
}));
app.use(flash());

// locals (єдине місце)
app.use(varMiddleware);

// static
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));

// CSRF: застосовуємо точково на потрібних роутерах
const csrfProtection = csrf({ cookie: false });
const injectCsrf = (req, res, next) => {
  // дублюємо токен у locals (раптом змінився після varMiddleware)
  res.locals.csrfToken = (typeof req.csrfToken === 'function') ? req.csrfToken() : undefined;
  next();
};

// routes
app.use('/', indexRouter);

// auth: показ форм + POST — під CSRF
app.use('/auth', csrfProtection, injectCsrf, authRouter);

// інші розділи (додай csrf за потреби на POST-форми)
app.use('/dashboard', dashboardRouter);
app.use('/users', usersRouter);
app.use('/documentation', documentationRouter);
app.use('/botstatistics', botStatisticsRouter);
app.use('/pwastatistics', pwaStatisticsRouter);
app.use('/statistics', statisticsRouter);
app.use('/download', downloadRouter);
app.use('/buying-team', buyingTeamRouter);

// 404
app.use((req, res, next) => next(createError(404, 'Сторінку не знайдено!')));

// error handler
app.use((err, req, res, next) => {
  // CSRF помилка → повертаємо на попередню сторінку/логін з флешем
  // if (err && err.code === 'EBADCSRFTOKEN') {
  //   req.flash('error', 'Невалідний CSRF токен. Онови сторінку й спробуй ще раз.');
  //   return res.redirect('back');
  // }

  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    req.flash('userError', 'Невалідний CSRF токен. Онови сторінку й спробуй ще раз.');
    return res.redirect('back');
  }
  next(err);
});

module.exports = app;
