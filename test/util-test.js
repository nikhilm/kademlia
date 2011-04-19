var vows = require('vows')
  , assert = require('assert');

var constants = require('../lib/constants');
var util = require('../lib/util');

h2b = util.hex2buf;

vows.describe('Utilities').addBatch({
    'The ID function': {
        topic: function() { return util.id },

        'returns a buffer': function(topic) {
            assert.ok(Buffer.isBuffer(topic('test')));
        },
        'returns a buffer of length constants.k': function(topic) {
            for( var i = 0; i < 100; ++i ) {
                assert.equal( topic(''+Math.random()).length, constants.k);
            }
        }
    },

    'The h2b function': {
        topic: function() { return h2b; },

        'returns a buffer': function(topic) {
            assert.ok(Buffer.isBuffer(topic('0123456789abcdef')));
        },

        'accepts only valid hexadecimal': function(topic) {
            assert.throws(function() {
                topic('ghijklm');
            });
            assert.throws(function() {
                topic('123xyz');
            });
        }
    },

    'The id_compare function': {
        topic: function() { return util.id_compare; },

        'works': function(topic) {
            assert.equal(
                topic(
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0587'),
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0588')
                ),
            -1);
            assert.equal(
                topic(
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0588'),
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0587')
                ),
            1);
            assert.equal(
                topic(
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0588'),
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0588')
                ),
            0);
            assert.equal(
                topic(
                    h2b('1fbfba8945192d408dcdcc52ba24903a328f0586'),
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0586')
                ),
            1);
            assert.equal(
                topic(
                    h2b('1fbfba8945192d408d3dcc52ba24903a328f0586'),
                    h2b('1fbfba8945192d408dcdcc52b924903a328f0586')
                ),
            -1);
        },

        'can be used to sort an array': function(topic) {
            var arr = [
                h2b('ffbfba8945192d408d3dcc52ba24903a00000000'),
                h2b('1fbfba8945192d408dcdcc52b924903a328f0286'),
                h2b('1fbfba7945192d408d3dcc52ba24903a328f0586'),
                h2b('8fbfca7945122d408d3dcc52ba24903a328f0586'),
            ];

            arr.sort(topic);

            assert.deepEqual(arr[0], h2b('1fbfba7945192d408d3dcc52ba24903a328f0586'));
            assert.deepEqual(arr[1], h2b('1fbfba8945192d408dcdcc52b924903a328f0286'));
            assert.deepEqual(arr[2], h2b('8fbfca7945122d408d3dcc52ba24903a328f0586'));
            assert.deepEqual(arr[3], h2b('ffbfba8945192d408d3dcc52ba24903a00000000'));
        }
    },

    'The distance function': {
        topic: function() { return util.distance; },
        'works': function(topic) {
            assert.deepEqual(
                util.distance(
                    h2b('ffbfba8945192d408d3dcc52ba24903a00000000'),
                    h2b('ffbfba8945192d408d3dcc52ba24903a00000001')
                ),
                h2b('0000000000000000000000000000000000000001')
            );
            assert.deepEqual(
                util.distance(
                    h2b('ffcfba8945192d408d3dcc52ba24903a00000000'),
                    h2b('ffbfba8945192d408d3dcc52ba24903a00000001')
                ),
                h2b('0070000000000000000000000000000000000001')
            );
        }
    }
}).export(module);
