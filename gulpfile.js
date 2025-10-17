const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');
const path = require('path');

// Path to SCSS and output CSS directory
const scssPath = './src/**/*.scss';
const cssOutputPath = './public';

// Flag icons
const FLAGS_SRC = path.join('node_modules', 'flag-icons', 'flags', '4x3', '**/*.svg');
const FLAGS_DST = path.join('public', 'flags', '4x3');

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

gulp.task('copy:flags', function copyFlags() {
  // Copy all 4x3 SVG flags to public
  return gulp.src(FLAGS_SRC).pipe(gulp.dest(FLAGS_DST));
});

// Optionally include into your main build pipeline
gulp.task('build', gulp.series('copy:flags'));

// Export task
exports.default = gulp.series(compileScss, watchScss);
