/*
 * grunt-dotjs
 * https://github.com/fuwaneko/grunt-dotjs
 *
 * Copyright (c) 2013 Dmitry Gorbunov
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  grunt.util = grunt.util || grunt.utils;

  var _ = grunt.util._;

  var path    = require('path'),
      fs      = require('fs'),
      cleaner = /^\s+|\s+$|[\r\n]+/gm,
      doT     = require('dot');

  // Please see the grunt documentation for more information regarding task and
  // helper creation: https://github.com/gruntjs/grunt/blob/master/docs/toc.md

  // ==========================================================================
  // TASKS
  // ==========================================================================

  grunt.registerMultiTask('dotjs', 'prepares and combines any type of template into a script include', function() {
    // grap the filepattern
    var files = grunt.file.expand({filter: 'isFile'}, this.files[0].src);
    // create the hogan include
    var src = GruntDotCompiler.compileTemplates(files, this.data.options);
    // write the new file
    grunt.file.write(this.files[0].dest, src);
    // log our success
    grunt.log.writeln('File "' + this.files[0].dest + '" created.');
  });
  
  
  // ==========================================================================
  // HELPERS
  // ==========================================================================
  var GruntDotCompiler = {};
  GruntDotCompiler.compileTemplates = function(files, options) {

    var js = '';

    options = _.defaults(options || {}, {
      variable: 'tmpl',
      expose: true,
      key: function(filepath) {
        return path.basename(filepath, path.extname(filepath));
      },
      prefix: 'doT.template(',
      suffix: ')',
      node: true,
      requirejs: true
    });

    options.variable = options.variable.replace('window.', '');

    // RequireJS
    if(options.requirejs && options.node) {
      js += 'if(typeof define !== "function") {' + grunt.util.linefeed;
      js +=   'define = require( "amdefine")(module)' + grunt.util.linefeed;
      js += '}' + grunt.util.linefeed;
    }

    if(options.requirejs) {
      js += 'define(function() {' + grunt.util.linefeed;
    }

    // Defining encodeHTML method for the templates
    js += 'function encodeHTMLSource() {';
    js += 'var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", \'"\': \'&#34;\', "\'": \'&#39;\', "/": \'&#47;\' },';
    js += 'matchHTML = /&(?!#?\w+;)|<|>|"|\'|\\//g;';
    js += 'return function() {';
    js += 'return this ? this.replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : this;';
    js += '};';
    js += '};' + grunt.util.linefeed;

    js += 'String.prototype.encodeHTML=encodeHTMLSource();';
    js += "\n";
    
    var variables = options.variable.split('.');

    _.each(variables, function(v) {
      js += 'var ' + v + '=' + v + '|| {};' + grunt.util.linefeed;
    });
    
    js += 'var partials = [];\n';

    var defs = {};
    defs.loadfile = function( path ) {
      return fs.readFileSync( path );
    };
    defs.root = options.root;
    
    var templates = files.reduce(function(result, filepath) {
      var key = options.key(filepath);
      var contents = grunt.file.read(filepath)
        //.replace(/\/\/.*\n/gm,'')
        .replace(cleaner, '')
        .replace(/'/g, "\\'");
        //.replace(/\/\*.*?\*\//gm,'');
            
      if (contents.search("\{\{\#def") >= 0)
      {
          var compile = options.prefix + '\'' + contents + '\', undefined, { partials: partials }' + options.suffix + ';' + grunt.util.linefeed;
          if( options.node ) {
            compile = eval( compile );
            console.log(key + ' = ' + compile);
          }
          var res = ' ' + options.variable + "['" + key + "']=" + compile + grunt.util.linefeed;
          
          result.defs.push(res);
      }
      else
      {
          var compile = options.prefix + '\'' + contents + '\'' + options.suffix + ';' + grunt.util.linefeed;
          if( options.node ) {
            compile = eval( compile );
            console.log(key + ' = ' + compile);
          }
          //var res = ' ' + options.variable + "['" + key + "']=" + compile + grunt.util.linefeed;
          var res = ' ' + options.variable + "['" + key + "']=" + "partials['" + key + "'];" + grunt.util.linefeed;
          
          result.clear.push(res);
          result.html.push("partials['" + key + "'] = '" + contents + "';\n");
      }
      
      return result;
    }, {
        clear: [],
        html: [],
        defs: []
    });
        
    _.each(templates.html, function(template) {
        js += template;
    });
        
    _.each(templates.clear, function(template) {
        js += template;
    });
    
    _.each(templates.defs, function(template) {
        js += template;
    });

    if(options.requirejs) {
      js += 'return ' + options.variable + ';});' + grunt.util.linefeed;
    } else if(options.node) {
      js += 'module.exports = ' + options.variable + ';';
    }
    
    if (options.expose)
        js += "window." + options.variable + " = " + options.variable + ";";

    return js;

  };

};
