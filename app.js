const express = require('express');
const path = require('path');
const helmet = require('helmet');
const createError = require('http-errors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const flash = require('connect-flash');
const dbHelper = require('./helpers/dbHelper');
const MongoStore = require('connect-mongodb-session')(session);
const csurf = require('csurf');
const logger = require('morgan');
const dotenv = require('dotenv').config();

const varMiddlware = require('./middleware/variables');

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

// DB Connection
const { MONGODB_URI, SESSION_SECRET, COOKIE_AGE } = process.env;
dbHelper.dbConnect(MONGODB_URI);

const app = express();
const store = new MongoStore({
  collection: 'sessions',
  uri: MONGODB_URI
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(helmet());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: SESSION_SECRET,
  resave: true,
  saveUninitialized: false,
  // cookie: {
  //   // expires: new Date(Date.now() + (24 * 60 * 60 * 1000)),
  //   expires: new Date(Date.now() + (20 * 1000)),
  // },
  cookie: {
    maxAge: 1000 * 60 * 60 * COOKIE_AGE
  },
  store: store,
}));
app.use(flash());
app.use(varMiddlware);

// Routes
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/dashboard', dashboardRouter);
app.use('/users', usersRouter);
app.use('/documentation', documentationRouter);
app.use('/botstatistics', botStatisticsRouter);
app.use('/pwastatistics', pwaStatisticsRouter);
app.use('/statistics', statisticsRouter);
app.use('/download', downloadRouter);
app.use('/buying-team', buyingTeamRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404, 'Сторінку не знайдено!'));
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  if (err && err.code === 'EBADCSRFTOKEN') {
    req.flash('error', 'Невалідний CSRF токен. Онови сторінку й спробуй ще раз.');
    return res.status(403).redirect('/auth');   // або куди логічно
  }

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.use(csurf());
// зробимо csrfToken доступним у всіх шаблонах
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  // уніфікуємо flash
  res.locals.userError = req.flash('userError');
  res.locals.userSuccess = req.flash('userSuccess');
  next();
});

// async function connectDB() {
//   try {
//     await mongoose.connect(MONGODB_URI);
//     console.log('Connected!');
//   } catch (error) {
//     console.error(error);
//   }
// }

// connectDB();
// mongoose.connect()
//   .then(() => console.log('Connected!'))
//   .catch(() => console.error('Database connection failed!'));

// console.log(process.env.PORT);
// console.log(module.parent);


// async () => {
//   app.listen(PORT || 3000, () => {
//     console.log(`Server is running on http://localhost:${PORT}`);
//   });
// }

module.exports = app;
