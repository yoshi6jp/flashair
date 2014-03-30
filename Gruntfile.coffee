fonts =
  names: [
    {from: "glyphicons-halflings-regular", to: "icon"}
    {from: "gochihand-regular-webfont", to: "hand"}
  ]
  exts:[ "woff", "eot", "svg", "ttf" ]
  src: "vender/fonts"
  dest: "dist/fonts"

fontFiles = []
fonts.names.forEach (name)->
  fonts.exts.forEach (ext)->
    fontFiles.push
      src: "#{fonts.src}/#{name.from}.#{ext}"
      dest: "#{fonts.dest}/#{name.to}.#{ext}"

module.exports = (grunt)->

  grunt.initConfig
    coffee:
      compile:
        files: 'js/flashair.js': 'coffee/flashair.coffee'
    uglify:
      options:
        mangle: false
      build:
        files: 'dist/app.js': ['vender/js/lib/*.js', 'vender/js/*.js',' js/flashair.js']
    copy:
      fonts:
        files: fontFiles
    less:
      compile:
        files: 'css/flashair.css': 'less/flashair.less'
    cssmin:
      build:
        files: 'dist/style.css': ['vender/css/*.css', 'css/flashair.css']

  grunt.loadNpmTasks 'grunt-contrib-uglify'
  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-contrib-copy'
  grunt.loadNpmTasks 'grunt-contrib-less'
  grunt.loadNpmTasks 'grunt-contrib-cssmin'

  grunt.registerTask 'default', ['copy', 'coffee', 'uglify', 'less', 'cssmin']

