var assert = require('assert');
var T = require('../../lib/types');

describe('Run-time type checking', function() {

  describe('when objects values are used', function() {

    // Build an example input schema
    var inputSchema = {
      foo: {
        type: {
          bar: {
            baz: 'string'
          },
          foo: {
            bar: {
              baz: 'integer'
            }
          }
        },
        required: true
      },
      bar: {
        type: 'integer',
        required: false
      }
    };


    ////////////////////////////////
    // Valid
    ////////////////////////////////

    it('should validate when all required keys are met', function() {
      var test = {
        foo: {
          bar: {
            baz: 'hello'
          },
          foo: {
            bar: {
              baz: 4
            }
          }
        }
      };

      assert.doesNotThrow(function() {
        T.rttc(inputSchema, test);
      });
    });

    it('should validate when all keys are valid', function() {
      var test = {
        foo: {
          bar: {
            baz: 'hello'
          },
          foo: {
            bar: {
              baz: 4
            }
          }
        },
        bar: 2
      };

      assert.doesNotThrow(function() {
        T.rttc(inputSchema, test);
      });
    });

    ////////////////////////////////
    // Invalid
    ////////////////////////////////

    it('should not validate when all required keys are not met', function() {
      var test = {
        bar: 2
      };

      assert.throws(function() {
        T.rttc(inputSchema, test);
      }, Error);
    });

    it('should not validate when all keys are not valid', function() {
      var test = {
        foo: {
          bar: {
            baz: 'hello'
          },
          foo: {
            bar: {
              baz: 'world'
            }
          }
        }
      };

      assert.throws(function() {
        T.rttc(inputSchema, test);
      }, Error);
    });

  });

});