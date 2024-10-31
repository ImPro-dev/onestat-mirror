const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');
const path = require('path');

// Path to SCSS and output CSS directory
const scssPath = './src/**/*.scss';
const cssOutputPath = './public';

// Task for SCSS->CSS compilation
function compileScss() {
  return gulp.src(scssPath)
    .pipe(sourcemaps.init())
    .pipe(sass().on('error', sass.logError))
    .pipe(rename((file) => {
      // Save directory structure
      file.dirname = path.join(file.dirname);
    }))
    .pipe(sourcemaps.write('./'))
    .pipe(gulp.dest(cssOutputPath));
}

// CSS changes watching
function watchScss() {
  gulp.watch(scssPath, compileScss);
}

// Export task
exports.default = gulp.series(compileScss, watchScss);
