"use strict";
var vows = require('vows')
  , assert = require('assert');

var _ = require('underscore');

var util = require('../lib/util');
var bucket = require('../lib/bucket');
var constants = require('../lib/constants');

vows.describe('Bucket').addBatch({
    'when created': {
        topic: new bucket.Bucket(),

        'has an empty contacts list': function(topic) {
            assert.equal(topic.size(), 0);
        },
        'cannot find a contact': function(topic) {
            assert.equal(
                topic.findContact('f572d396fae9206628714fb2ce00f72e94f2258f'),
                undefined);
        }
    },

    'on adding a contact and not being full': {
        topic: new bucket.Bucket(),

        'increases size by 1': function(topic) {
            var sz = topic.size();
            topic.add({ nodeID: util.id('foobar'), lastSeen: Date.now() });
            assert.equal(topic.size(), sz + 1);
            assert.equal(topic.get(0).nodeID, util.id('foobar'));
        },

        'holds elements in sorted order': function(topic) {
            // lets be underhanded and empty the bucket
            topic._contacts = [];

            var c1 = { nodeID: util.id('foo'), lastSeen: Date.now() };
            var c2 = { nodeID: util.id('bar'), lastSeen: 0 };
            var c3 = { nodeID: util.id('baz'), lastSeen: 145 };
            var c4 = { nodeID: util.id('kad'), lastSeen: 45 };
            var c5 = { nodeID: util.id('fob'), lastSeen: Date.now()+1 };

            var ids = function() {
                return _.pluck(topic._contacts, 'nodeID');
            }

            topic.add(c1);
            assert.deepEqual(ids(), [c1.nodeID]);

            topic.add(c2);
            assert.deepEqual(ids(), [c2.nodeID, c1.nodeID]);

            topic.add(c3);
            assert.deepEqual(ids(), [c2.nodeID, c3.nodeID, c1.nodeID]);

            topic.add(c4);
            assert.deepEqual(ids(), [c2.nodeID, c4.nodeID, c3.nodeID, c1.nodeID]);

            topic.add(c5);
            assert.deepEqual(ids(), [c2.nodeID, c4.nodeID, c3.nodeID, c1.nodeID, c5.nodeID]);
        },

        'checks if the contact already exists': function(topic) {
            topic._contacts = [];

            var c1 = { nodeID: util.id('foo'), lastSeen: Date.now() };
            topic.add(c1);
            topic.add(c1);
            assert.equal(topic.size(), 1);
        }
    },

    'on removing a contact': {
        topic: new bucket.Bucket(),

        'size decreases by 1': function(topic) {
            topic._contacts = [];
            var c1 = { nodeID: util.id('foo'), lastSeen: Date.now() };
            topic.add(c1);

            topic.remove(c1);
            assert.equal(topic.size(), 0);
        },

        'size does not change if contact does not exist': function(topic) {
            topic._contacts = [];
            var c1 = { nodeID: util.id('foo'), lastSeen: Date.now() };
            topic.add(c1);

            topic.remove({ nodeID: util.id('foos') });
            assert.equal(topic.size(), 1);
        },

        'removing from empty bucket is ok': function(topic) {
            topic._contacts = [];
            topic.remove({ nodeID: util.id('foos') });
            assert.equal(topic.size(), 0);
        }
    },

    'containment test': {
        topic: new bucket.Bucket(),

        'contains works': function(topic) {
            // lets be underhanded and empty the bucket
            topic._contacts = [];

            var c1 = { nodeID: util.id('foo'), lastSeen: Date.now() };
            var c2 = { nodeID: util.id('bar'), lastSeen: 0 };
            var c3 = { nodeID: util.id('baz'), lastSeen: 145 };
            var c4 = { nodeID: util.id('kad'), lastSeen: 45 };
            var c5 = { nodeID: util.id('fob'), lastSeen: Date.now()+1 };

            topic.add(c1);
            topic.add(c2);
            topic.add(c3);
            topic.add(c4);
            topic.add(c5);

            assert.isTrue(topic.contains(c1));
            assert.isTrue(topic.contains(c2));
            assert.isTrue(topic.contains(c3));
            assert.isTrue(topic.contains(c4));
            assert.isTrue(topic.contains(c5));

            topic.remove(c3);
            assert.isFalse(topic.contains(c3));
            assert.isTrue(topic.contains(c5));

            assert.isFalse(topic.contains({ nodeID: util.id('missing') }));
        }
    },

    'indexOf test': {
        topic: new bucket.Bucket(),

        'indexOf works': function(topic) {
            // lets be underhanded and empty the bucket
            topic._contacts = [];

            var c1 = { nodeID: util.id('foo'), lastSeen: Date.now() };
            var c2 = { nodeID: util.id('bar'), lastSeen: 0 };
            var c3 = { nodeID: util.id('baz'), lastSeen: 145 };
            var c4 = { nodeID: util.id('kad'), lastSeen: 45 };
            var c5 = { nodeID: util.id('fob'), lastSeen: Date.now()+1 };

            topic.add(c1);
            topic.add(c2);
            topic.add(c3);
            topic.add(c4);
            topic.add(c5);

            assert.equal(topic.indexOf(c1), 3);
            assert.equal(topic.indexOf(c2), 0);
            assert.equal(topic.indexOf(c3), 2);
            assert.equal(topic.indexOf(c4), 1);
            assert.equal(topic.indexOf(c5), 4);

            topic.remove(c5);
            assert.equal(topic.indexOf(c5), -1);

            assert.equal(topic.indexOf({ nodeID: util.id('missing') }), -1);
        }
    }
}).export(module);
