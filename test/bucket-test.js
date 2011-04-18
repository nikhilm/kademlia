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
    },
    'when a new contact is added to a partially full bucket': {
        topic: function() {
            var b = new bucket.Bucket();
            for( var i = 0; i < constants.k/2; i++ )
                b.updateContact({ id: ''+i });
            b.updateContact({id: 'f572d396fae9206628714fb2ce00f72e94f2258f'});
            return b;
        },

        'has atleast one contact': function(topic) {
            assert.notEqual(topic.contacts.length, 0);
        },
        'index of an existing contact is not -1': function(topic) {
            assert.notEqual(topic.indexOf('f572d396fae9206628714fb2ce00f72e94f2258f'), -1);
        }
    },

    'when an existing contact is added to a partially full bucket': {
        topic: function() {
            var b = new bucket.Bucket();
            for( var i = 0; i < constants.k/2; i++ )
                b.updateContact({ id: ''+i });
            b.updateContact({id: '3'});
            return b;
        },

        'has atleast one contact': function(topic) {
            assert.notEqual(topic.contacts.length, 0);
        },
        'index of an existing contact is not -1': function(topic) {
            assert.notEqual(topic.indexOf('2'), -1);
        },
        'the existing contact moves to the end of the list': function(topic) {
            assert.notEqual(topic.contacts[0].id, '3');
            assert.equal(topic.contacts[topic.contacts.length-1].id, '3');
        }
    },

    'when a new contact is added to a full bucket and oldest contact is online': {
        topic: function() {
            var b = new bucket.Bucket();
            // TODO: make a fake contact be online
            for( var i = 0; i < constants.k; i++ )
                b.updateContact({ id: ''+i });

            b.updateContact({ id: ''+constants.k+1});
        },

        'the contact should be rejected': function(topic) {
            assert.equal(topic.indexOf(constants.k+1), -1);
        }
    },

    'when a new contact is added to a full bucket and oldest contact is offline': {
        topic: function() {
            var b = new bucket.Bucket();
            for( var i = 0; i < constants.k; i++ )
                b.updateContact({ id: ''+i });

            b.updateContact({ id: ''+constants.k+1});
            // TODO: remove another fake contact
            //
            return b;
        },

        'the contact should be added': function(topic) {
            assert.notEqual(topic.indexOf(constants.k+1), -1);
        }
    }
}).export(module);
