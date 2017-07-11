/**
 * Module dependencies
 */

var util = require('util');
var path = require('path');
var _ = require('@sailshq/lodash');
var flaverr = require('flaverr');


/**
 * .pack()
 *
 * Load modules in the specified directory and expose them as
 * a dictionary of set machine instances.
 *
 * > This method is used by default in the index.js file of generated machinepacks.
 *
 * - - - - - - - - - - - - - - - - - - - - - - - - -
 * @required {Dictionary?|String} options
 *       Either the absolute path to the location of the modules to load & pack (see `dir` below)
 *       -OR- a dictionary of options:
 *
 *          @property {String} dir
 *              The absolute path to the location of the modules to load & pack.
 *              (If a relative path is specified, it will be resolved relative  from the `pkg`)
 *
 *          @property {Dictionary} pkg
 *              The package dictionary (i.e. what package.json exports).
 *              Will be used for refining the directory to load modules from.
 *              If `pkg` is not specified, all `.js` files in `dir` will be loaded
 *              (with the exception of `index.js`, which is reserved.)
 *
 *
 * @returns {Dictionary}
 *          A dictionary of packed modules with camel-cased keys ("method names"), and functions ("wet machines") as values.
 */

module.exports = function pack(options){

  // If specified as a string, understand as `options.dir`.
  if (_.isString(options)) {
    options = { dir: options };
  }
  else if (_.isUndefined(options)) {
    options = {};
  }
  else if (!_.isObject(options) || _.isFunction(options) || _.isArray(options)) {
    throw new Error('Usage error: `.pack()` expects a dictionary of options, but instead got:'+util.inspect(options, {depth:null}));
  }

  // Validate `dir`
  if (_.isUndefined(options.dir)) {
    throw new Error('Usage error: `.pack()` should be provided a `dir` option, but it was not provided.  Received options:'+util.inspect(options, {depth:null}));
  }
  if (!_.isString(options.dir)) {
    throw new Error('Usage error: `.pack()` received a `dir` path which is not a string:'+util.inspect(options.dir, {depth:null}));
  }

  // Validate `pkg`
  // (if specified, must be a dictionary)
  if (!_.isUndefined(options.pkg)) {
    if (!_.isObject(options.pkg) || _.isArray(options.pkg) || _.isFunction(options.pkg)) {
      throw new Error('Usage error: `.pack()` received an invalid `pkg`.  If specified, `pkg` must be a dictionary, but instead got:'+util.inspect(options.pkg, {depth:null}));
    }
  }


  // Build up a constant array of unconventional method names
  // (used below to show a warning if a machine identity looks too similar to native JS or Node stuff.)
  var UNCONVENTIONAL_METHOD_NAMES = [
    'inspect', 'toString', 'valueOf', 'toLocaleString',
    'prototype', 'constructor',
    'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable'
  ];


  // Sanity
  if (!_.isObject(this) || !_.isFunction(this.build)) { throw new Error('Consistency violation: Context (`this`) is wrong in Machine.pack()!'); }

  // Get the `Machine` constructor
  var Machine = this;

  // Now load & pack the modules.
  var PackedModules;



  //  ┬┌─┐  ╔═╗╦╔═╔═╗  ┬ ┬┌─┐┌─┐  ┌─┐┌─┐┌─┐┌─┐┬┌─┐┬┌─┐┌┬┐
  //  │├┤   ╠═╝╠╩╗║ ╦  │││├─┤└─┐  └─┐├─┘├┤ │  │├┤ │├┤  ││
  //  ┴└    ╩  ╩ ╩╚═╝  └┴┘┴ ┴└─┘  └─┘┴  └─┘└─┘┴└  ┴└─┘─┴┘ooo
  // If `pkg` was specified...
  if (!_.isUndefined(options.pkg)) {

    var machines;
    try {
      machines = options.pkg.machinepack.machines;
    }
    catch (e) {
      throw flaverr('E_INVALID_OPTION', new Error(
        'Failed to instantiate hydrated machinepack using the provided `pkg`.\n'+
        '`pkg` should be a dictionary with a `machinepack` property (also a dictionary, '+
        'with its own array of strings called `machines`).\n'+
        'But the actual `pkg` option provided was:\n'+
        '------------------------------------------------------\n'+
        ''+util.inspect(options.pkg, false, null)+'\n'+
        '------------------------------------------------------\n'+
        'Raw error details:\n'+e.stack)
      );
    }

    // Build a dictionary of all the machines in this pack
    PackedModules = _.reduce(machines, function (memo, machineID) {
      // console.log('machineID:',machineID);

      try {
        // Require and hydrate each static definition into a callable machine fn
        var requirePath = path.resolve(options.dir, options.pkg.machinepack.machineDir || options.pkg.machinepack.machinedir || '', machineID);
        // console.log('requirePath:',requirePath);
        var definition = require(requirePath);
        // console.log('definition.identity:',definition.identity);
        // console.log('!!definition.identity:',!!definition.identity);

        // Attach the string identity as referenced in package.json to
        // the machine definition dictionary as its "identity"
        // (unless the machine definition already has an "identity" explicitly specified)
        definition.identity = definition.identity || machineID;

        // Build the machine.
        var machineInstance = Machine(definition);

        // Determine the method name.
        var methodName = Machine.getMethodName(definition.identity);
        if (_.contains(UNCONVENTIONAL_METHOD_NAMES, methodName)) {
          console.warn('Warning: Machine "'+definition.identity+'" has an unconventional identity that, when converted to a method name (`'+methodName+'`), could conflict with native features of JavaScript/Node.js.  Please consider changing it!');
        }

        // Expose the machine as a method on our Pack dictionary.
        memo[methodName] = machineInstance;
      }
      catch (e) {

        // Check and see if this is a MODULE_ERROR-
        // if so, then it's a very different scenario and we should show a different
        // error message.
        if (e.code === 'MODULE_NOT_FOUND') {
          throw flaverr({
            name: 'ImplementationError',
            code: 'E_MACHINE_NOT_FOUND',
            raw: e
          }, new Error(
            'Failed to load `'+machineID+'`, one of the identities listed in `pkg.machinepack.machines`,\n'+
            'an array of strings which correspond to the filenames of modules in this machinepack.\n\n'+
            'Details:\n'+
            '------------------------------------------------------\n'+
            util.inspect(e, {depth: 5})+'\n'+
            '------------------------------------------------------\n'
          ));
        }

        // --•
        throw (function _buildInvalidMachineError(){
          e.originalError = e;
          e.code = 'E_INVALID_MACHINE';
          e.message = util.format(
          '\n'+
          'Failed to instantiate machine "%s" (listed in `pkg.machinepack.machines`).\n'+
          '`pkg.machinepack.machines` should be an array of strings which correspond \n'+
          'to the filenames of machine modules in this machinepack.\n\n'+
          'The actual `pkg` option provided was:\n'+
          '------------------------------------------------------\n'+
          '%s\n'+
          '------------------------------------------------------\n\n'+
          'Error details:\n',
          machineID,
          util.inspect(options.pkg, false, null),
          e.originalError);
          return e;
        })();//</throw>
      }
      return memo;
    }, {});
  }//</if `pkg` option was specified>
  else {
    throw new Error('pkg option is mandatory again, for the time being.');
  }
  // //  ┌─┐┬  ┌─┐┌─┐  ┌─┐┬┌─┌─┐  ┬ ┬┌─┐┌─┐  ╔╗╔╔═╗╔╦╗  ┌─┐┌─┐┌─┐┌─┐┬┌─┐┬┌─┐┌┬┐
  // //  ├┤ │  └─┐├┤   ├─┘├┴┐│ ┬  │││├─┤└─┐  ║║║║ ║ ║   └─┐├─┘├┤ │  │├┤ │├┤  ││
  // //  └─┘┴─┘└─┘└─┘  ┴  ┴ ┴└─┘  └┴┘┴ ┴└─┘  ╝╚╝╚═╝ ╩   └─┘┴  └─┘└─┘┴└  ┴└─┘─┴┘
  // // Otherwise, `pkg` was not specified, so just load all `.js` files in `dir`.
  // else {

  //   // Ensure we have an absolute path.
  //   options.dir = path.resolve(options.dir);

  //   // Load modules (as dry machine definitions)
  //   var inventory = includeAll({
  //     dirname: options.dir,
  //     filter: /(.+)\.js/,
  //     exclude: [
  //       /^index.js$/
  //     ],
  //     flatten: true
  //   });

  //   // Now pack the modules, building each individual machine instance.
  //   PackedModules = _.reduce(inventory, function (memo, rawNMDef, key) {

  //     // Come up with an identity for debugging purposes.
  //     rawNMDef.identity = _.kebabCase(key);

  //     // Determine the method name.
  //     var methodName = getMethodName(rawNMDef.identity);
  //     if (_.contains(UNCONVENTIONAL_METHOD_NAMES, methodName)) {
  //       console.warn('Warning: Machine "'+rawNMDef.identity+'" has an unconventional identity that, when converted to a method name (`'+methodName+'`), could conflict with native features of JavaScript/Node.js.  Please consider changing it!');
  //     }

  //     memo[methodName] = Machine.build(rawNMDef);
  //     return memo;
  //   }, {});

  // }//</else (no pkg option specified)>


  return PackedModules;

};