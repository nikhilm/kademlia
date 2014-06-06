"use strict";
var vows = require('vows')
  , assert = require('assert');

var Faker = require('Faker');
var _ = require('lodash');

var constants = require('../lib/constants');
var util = require('../lib/util');

var h2b = util.hex2buf;

vows.describe('Utilities').addBatch({
    'The ID function': {
        topic: function() { return util.id },

        'returns a string': function(topic) {
            assert.isString(topic('test'));
        },
        'returns a string of length constants.K*2': function(topic) {
            for( var i = 0; i < 100; ++i ) {
                assert.equal(topic(''+Math.random()).length, constants.K*2);
            }
        }
    },

    'The h2b function': {
        topic: function() { return h2b; },

        'returns a buffer': function(topic) {
            assert.ok(Buffer.isBuffer(topic('0123456789abcdef')));
        },

        /*'accepts only valid hexadecimal': function(topic) {
            assert.throws(function() {
                topic('ghijklm');
            });
            assert.throws(function() {
                topic('123xyz');
            });
        }*/
    },

    'The id_compare function': {
        topic: function() { return util.id_compare; },

        'works': function(topic) {
            assert.equal(
                topic(
                    '1fbfba8945192d408dcdcc52b924903a328f0587',
                    '1fbfba8945192d408dcdcc52b924903a328f0588'
                ),
            -1);
            assert.equal(
                topic(
                    '1fbfba8945192d408dcdcc52b924903a328f0588',
                    '1fbfba8945192d408dcdcc52b924903a328f0587'
                ),
            1);
            assert.equal(
                topic(
                    '1fbfba8945192d408dcdcc52b924903a328f0588',
                    '1fbfba8945192d408dcdcc52b924903a328f0588'
                ),
            0);
            assert.equal(
                topic(
                    '1fbfba8945192d408dcdcc52ba24903a328f0586',
                    '1fbfba8945192d408dcdcc52b924903a328f0586'
                ),
            1);
            assert.equal(
                topic(
                    '1fbfba8945192d408d3dcc52ba24903a328f0586',
                    '1fbfba8945192d408dcdcc52b924903a328f0586'
                ),
            -1);
        },

        'can be used to sort an array': function(topic) {
            var arr = [
                'ffbfba8945192d408d3dcc52ba24903a00000000',
                '1fbfba8945192d408dcdcc52b924903a328f0286',
                '1fbfba7945192d408d3dcc52ba24903a328f0586',
                '8fbfca7945122d408d3dcc52ba24903a328f0586',
            ];

            arr.sort(topic);

            assert.deepEqual(arr[0], '1fbfba7945192d408d3dcc52ba24903a328f0586');
            assert.deepEqual(arr[1], '1fbfba8945192d408dcdcc52b924903a328f0286');
            assert.deepEqual(arr[2], '8fbfca7945122d408d3dcc52ba24903a328f0586');
            assert.deepEqual(arr[3], 'ffbfba8945192d408d3dcc52ba24903a00000000');
        }
    },

    'The distance function': {
        topic: function() { return util.distance; },
        'works': function(topic) {
            assert.deepEqual(
                util.distance(
                    'ffbfba8945192d408d3dcc52ba24903a00000000',
                    'ffbfba8945192d408d3dcc52ba24903a00000001'
                ),
                h2b('0000000000000000000000000000000000000001')
            );
            assert.deepEqual(
                util.distance(
                    'ffcfba8945192d408d3dcc52ba24903a00000000',
                    'ffbfba8945192d408d3dcc52ba24903a00000001'
                ),
                h2b('0070000000000000000000000000000000000001')
            );
        }
    },

    'The bucketIndex function': {
        topic: function() { return util.bucketIndex; },
        'works': function(topic) {
            assert.equal(topic('ffbfba8945192d408d3dcc52ba24903a00000000',
                               'ffbfba8945192d408d3dcc52ba24903a00000001'), 0);
            assert.equal(topic('ffcfba8945192d408d3dcc52ba24903a00000000',
                               'ffbfba8945192d408d3dcc52ba24903a00000001'), 150);
            assert.equal(topic(util.id('nikhil'),
                               util.id('kademlia')), 159);
        },

        'does not collide (usually)': function(topic) {
            for (var i = 1; i <= 10000; i++) {
                var id1 = util.id(Faker.Lorem.sentence());
                var id2 = util.id(Faker.Lorem.sentence());
                assert.notEqual(topic(id1, id2), constants.B);
            }
        }
    },

    'The powerOfTwoBuffer function': {
        topic: function() { return util.powerOfTwoBuffer; },
        'stays within range': function(topic) {
            assert.throws(function() { topic(constants.B + 1); });
            assert.throws(function() { topic(-1); });
            assert.ok(topic(5));
        },

        'works': function(topic) {
            var mkBuf = function() {
                var b = new Buffer(constants.K);
                b.fill(0);
                return b;
            }

            var equal = function(exp, byteIndex, value) {
                var b = mkBuf();
                b[byteIndex] = value;

                var test = topic(exp);
                assert.equal(b.length, test.length);
                for (var i = 0; i < b.length; i++)
                    assert.equal(b[i], test[i]);
            }

            equal(0, 19, 1);
            equal(159, 0, 0x80);
            equal(155, 0, 0x08);
            equal(10, 18, 0x04);
            equal(16, 17, 0x01);
        }
    },

    'The randomInBucketRangeBuffer function': {
        topic: function() { return util.randomInBucketRangeBuffer; },

        'works': function(topic) {
            function checkZero(buffer, tillIndex) {
                for (var i = 0; i < tillIndex; i++)
                    assert.equal(buffer[i], 0);
            }

            function test(n) {
                var zeroTill = constants.K - (parseInt(n/8) + 1);
                var pow = Math.pow(2, n%8 + 1);
                _(500).times(function() {
                    var num = topic(n);
                    checkZero(num, zeroTill);
                    assert.ok(num[zeroTill] < pow);
                });
            }

            _.range(0, constants.B).forEach(function(i) {
                test(i);
            });
        }
    },
	
   'Message Compaction': {
        'lossless': function(topic) {
			function test(a) {
				var as = util.messageToString(a);
				var am = util.messageFromString(as);
				/*console.log();
				console.log(a);
				console.log(as);
				console.log(am);*/
				assert.ok(_.isEqual(a, am));			
			}
			
			test({
				id: 'i',
				nodeID: 'n',
				extra: 'e',
				type: 't'
			});
			test({ 
				type: 't',
				nodeID: '60c93d92a1bb9a0b71c8b063a51afd5547f0e937',
  				id: '60c93d92a1bb9a0b71c8b063a51afd5547f0e937' 
			});
			
        }
    }	
	
	
}).export(module);
