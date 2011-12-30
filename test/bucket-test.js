var vows = require('vows')
  , assert = require('assert');

var bucket = require('../lib/bucket');
var constants = require('../lib/constants');

vows.describe('Bucket').addBatch({
    'when created': {
        topic: new bucket.Bucket(),

        'has an empty contacts list': function(topic) {
            assert.equal(topic.contacts, false);
        },
        'cannot find a contact': function(topic) {
            assert.equal(
                topic.findContact('f572d396fae9206628714fb2ce00f72e94f2258f'),
                undefined);
        }
    }
}).export(module);
