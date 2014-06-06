"use strict";
var vows = require('vows')
  , assert = require('assert');

var _ = require('lodash');
var Faker = require('Faker');

var constants = require('../lib/constants');
var util = require('../lib/util');
var knode = require('../lib/knode');

vows.describe('KNode').addBatch({
    'On KNode creation': {
        topic: new knode.KNode({ address: '127.0.0.1', port: 65535 }),
        'KNode._self should be frozen': function(topic) {
            assert.throws(function() { topic._self.prop = "invalid"; }, TypeError);
        },
    },

    'Storing a value on a disconnected node': {
        topic: function() {
            var node = new knode.KNode({ address: '127.0.0.1', port: 65535 });
            var self = this;
            node.set('foo', 'bar', function(err) {
            console.error(err);
                if (err)
                    self.callback(null);
                else
                    self.callback({message: "this shouldn't happen!"});
            });
        },
        'should fail': function(err) {
        }
    },

    'The KNode ping operation': {
    },

    'The KNode store operation': {
        topic: function() {
            var node = new knode.KNode({ address: '127.0.0.1', port: 65534 });
            var self = this;
            node._rpc = {
                send: function(contact, message) {
                    self.callback(null /*error object*/, {node: node, contact: contact, message: message});
                }
            }

            var message = {
                'address': '127.0.0.1',
                'port': 1456,
                'key': util.id('old silver'),
                'value': 'opens the cupboard underneath the stairs',
                'rpcID': util.id('random id')
            };
            _.extend(message, { nodeID: util.nodeID(message.address, message.port) });

            node._onStore(message);
        },

        'replies to the sender': function(err, obj) {
            assert.equal(obj.contact.port, 1456);
        },

        'replies with success on proper store': function(err, obj) {
            assert.equal(obj.node._storage[util.id('old silver')], 'opens the cupboard underneath the stairs');
            assert.isTrue(obj.message.s==1);
        }
    }
}).export(module);
