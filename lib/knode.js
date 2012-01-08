/*
 * Copyright (C) 2011 by Nikhil Marathe <nsm.nikhil@gmail.com>
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
"use strict";

var assert = require('assert');
var node_constants = require('constants');
var async = require('async');
var constants = require('./constants');
var util = require('./util');
var rpc = require('./rpc');
var Bucket = require('./bucket').Bucket;
var _ = require('underscore');
_.str = require('underscore.string');

// abbreviate message utilities
var MC = util.message_contact;
var MID = util.message_rpcID;

exports.KNode = function(desc) {
    // TODO: probably want to persist nodeID
    this.self = _.defaults({ nodeID: util.nodeID(desc.address, desc.port) }, desc);
    Object.freeze(this.self);

    this._storage = {};
    // object treated as an array
    this._buckets = {};
    this._rpc = new rpc.RPC(this.self, _.bind(this._onMessage, this));

    // DEBUG
    setInterval(_.bind(this.debug, this), 5000);
}

exports.KNode.prototype._MSG = function(type, params) {
    // NOTE: always keep this.self last. This way users of _MSG
    // don't have to worry about accidentally overriding self properties
    return _.extend({ type: type}, params, this.self);
}

exports.KNode.prototype._onMessage = function(message) {
    var methodName = '_on' + _.str.titleize(_.str.camelize(message.type.toLowerCase()));
    var action = this[methodName];
    if (action) {
        this._updateContact(MC(message));
        _.bind(action, this)(message);
    }
    else
        console.warn("Unknown message", message);
}

exports.KNode.prototype._ping = function(contact) {

    function onPong(err, message) {
        if (err && err.errno == node_constants.ETIMEDOUT) {
            // TODO: handle peer death
        }
        else {
            assert.equal(message.type, 'PONG');
            this._updateContact(MC(message));
        }
    }

    this._rpc.send(contact, this._MSG('PING'), _.bind(onPong, this));
}

exports.KNode.prototype._onPing = function(message) {
    // this can be made more intelligent such that
    // if an outgoing message is present, piggyback the pong
    // onto it rather than sending it separately
    this._rpc.send(MC(message), this._MSG('PONG', {'replyTo': MID(message)}));
}

exports.KNode.prototype._updateContact = function(contact, cb) {
    var callback = cb || function() {};
    var bucketIndex = util.bucketIndex(this.self.nodeID, contact.nodeID);
    assert.ok(bucketIndex < constants.B);
    if (!this._buckets[bucketIndex])
        this._buckets[bucketIndex] = new Bucket();

    var bucket = this._buckets[bucketIndex];
    contact.lastSeen = Date.now();

    var exists = bucket.contains(contact);
    if (exists) {
        // move to the end of the bucket
        bucket.remove(contact);
        bucket.add(contact);
        callback();
    }
    else if (bucket.size() < 8 /*constants.K*/) { // TODO: FIXME: use constants.K
        bucket.add(contact);
        callback();
    }
    else { // TODO:
        this._rpc.send(bucket.get(0), this._MSG('PING'),
            _.bind(function(err, message) {
                if( err ) {
                    // add new contact, old one is dead
                    console.log("Bucket", bucketIndex, "Booted", bucket.get(0), "added", contact);
                    bucket.removeIndex(0);
                    bucket.add(contact);
                }
                else {
                    console.log("Bucket", bucketIndex, "Keeping existing contact");
                }
                callback();
            }), this);
    }
}

// TODO: handle large values which
// won't fit in single UDP packets
exports.KNode.prototype._onStore = function(message) {
    assert.equal(message.key.length, constants.B/4);
    this._storage[message.key] = _.clone(message.value);
    this._rpc.send(MC(message), this._MSG('STORE_REPLY', {
        'replyTo': MID(message),
        'status': true
    }));
}

exports.KNode.prototype._onFindValue = function(message) {
    assert.ok(message.key);
    assert.equal(message.key.length, constants.B/4);
    if (this._storage.hasOwnProperty(message.key)) {
        this._rpc.send(MC(message), this._MSG('FIND_VALUE_REPLY', {
            'replyTo': MID(message),
            'found': true,
            'value': this._storage[message.key]
        }));
    }
    else {
        var contacts = this._findClosestNodes(message.key, constants.K, MC(message).nodeID);

        this._rpc.send(MC(message), this._MSG('FIND_NODE_REPLY', {
            'replyTo': MID(message),
            'contacts': contacts
        }));
    }
}

exports.KNode.prototype._findClosestNodes = function(key, howMany, exclude) {
    var contacts = [];
    function addContact(contact) {
        if (contacts.length >= howMany)
            return;

        if (contact.nodeID == exclude)
            return;

        contacts.push(contact);
    }

    function addClosestFromBucket(bucket) {
        var distances = _.map(bucket.contacts(), function(contact) {
            return {
                distance: util.distance(contact.nodeID, key),
                contact: contact
            };
        });

        distances.sort(function(a, b) {
            return util.buffer_compare(a.distance, b.distance);
        });

        _(distances).chain()
         .first(howMany - contacts.length)
         .pluck('contact')
         .map(MC)
         .value()
         .forEach(addContact);
    }

    // first check the same bucket
    // what bucket would key go into, that is the closest
    // bucket we start from, hence bucketIndex
    // is with reference to self.nodeID
    var bucketIndex = util.bucketIndex(this.self.nodeID, key);
    if (this._buckets.hasOwnProperty(bucketIndex))
        addClosestFromBucket(this._buckets[bucketIndex]);

    var oldBucketIndex = bucketIndex;
    // then check buckets higher up
    while (contacts.length < howMany && bucketIndex < constants.B) {
        bucketIndex++;
        if (this._buckets.hasOwnProperty(bucketIndex))
            addClosestFromBucket(this._buckets[bucketIndex]);
    }

    // then check buckets lower down
    // since Kademlia does not define the search strategy, we can cheat
    // and use this strategy although it may not actually return the closest
    // FIXME: be intelligent to choose actual closest
    bucketIndex = oldBucketIndex;
    while (contacts.length < howMany && bucketIndex >= 0) {
        bucketIndex--;
        if (this._buckets.hasOwnProperty(bucketIndex))
            addClosestFromBucket(this._buckets[bucketIndex]);
    }
    return contacts;
}

exports.KNode.prototype._refreshBucket = function(bucketIndex) {
    var random = util.randomInBucketRangeBuffer(bucketIndex);
    this._iterativeFindNode(random.toString('hex'));
}

// this is a primitive operation, no network activity allowed
exports.KNode.prototype._onFindNode = function(message) {
    assert.ok(message.key);

    var contacts = this._findClosestNodes(message.key, constants.K, MC(message).nodeID);

    this._rpc.send(MC(message), this._MSG('FIND_NODE_REPLY', {
        'replyTo': MID(message),
        'contacts': contacts
    }));
}

exports.KNode.prototype._iterativeFindNode = function(nodeID, cb) {
    var externalCallback = cb || function() {};

    var closestNode = null, previousClosestNode = null;
    var closestNodeDistance = -1;
    var shortlist = this._findClosestNodes(nodeID, constants.ALPHA, this.self.nodeID);
    var contacted = {};
    closestNode = shortlist[0];
    closestNodeDistance = util.distance(nodeID, closestNode.nodeID);

    function xyz(alphaContacts) {
        // clone because we're going to be modifying inside
        async.forEach(alphaContacts, _.bind(function(contact, callback) {
            this._rpc.send(contact, this._MSG('FIND_NODE', {
                key: nodeID
            }), _.bind(function(err, message) {
                if (err) {
                    console.log("ERROR in iterativeFindNode send to", contact);
                    shortlist = _.reject(shortlist, function(el) { console.log(el.nodeID, contact.nodeID); return el.nodeID == contact.nodeID; });
                }
                else {
                    this._updateContact(contact);
                    contacted[contact.nodeID] = true;
                    var dist = util.distance(nodeID, contact.nodeID);
                    if (util.buffer_compare(dist, closestNodeDistance) == -1) {
                        previousClosestNode = closestNode;
                        closestNode = contact;
                        closestNodeDistance = dist;
                    }

                    shortlist = shortlist.concat(message.contacts);
                }
                callback();
            }, this));
        }, this), _.bind(function(err) {
            if (closestNode == previousClosestNode || shortlist.length >= constants.K) {
            // TODO: clarify we might have to do a FIND_NODE here too
                externalCallback(shortlist);
                return;
            }

            var remain = _.reject(shortlist, function(el) { return contacted[el.nodeID]; })
            // TODO: call only on alpha random
            if (remain.length == 0)
                externalCallback(shortlist);
            else
                _.bind(xyz, this)(remain);
        }, this));
    }
    _.bind(xyz, this)(shortlist);
}

exports.KNode.prototype.toString = function() {
    return "Node " + this.self.nodeID + ":" + this.self.address + ":" + this.self.port;
}

exports.KNode.prototype.debug = function() {
    console.log(this.toString());
    _(this._buckets).each(function(bucket, j) {
        //console.log("bucket", j, bucket.toString());
        console.log("bucket", j, bucket.size(), "peers");
    });
    console.log("store", this._storage);
}

/***** Public API *****/
exports.KNode.prototype.connect = function(address, port, cb) {
    var callback = cb || function() {};
    assert.ok(this.self.nodeID);
    var contact = util.make_contact(address, port);
    this._updateContact(contact, _.bind(function() {
        this._iterativeFindNode(this.self.nodeID, _.bind(function(err, contacts) {
            if (err) {
                callback(err);
                return;
            }
            // FIXME: Do we update buckets or does iterativeFindNode do it?
            var leastBucket = _.min(_.keys(this._buckets));
            var bucketsToRefresh = _.filter(_.keys(this._buckets), function(num) { return num >= leastBucket; });
            // TODO: do each refresh only after earlier finishes
            _.each(bucketsToRefresh, this._refreshBucket, this);
            // TODO: use async module to trigger callback when all done
            callback(null);
        }, this));
    }, this));
}

exports.KNode.prototype.set = function(key, value, cb) {
    var callback = cb || function() {};
    var message = this._MSG('STORE', {
        'key': util.id(key),
        'value': value
    });
    this._iterativeFindNode(util.id(key), _.bind(function(contacts) {
        async.forEach(contacts, _.bind(function(contact, asyncCb) {
            this._rpc.send(contact, message, function() {
                // TODO handle error
                asyncCb(null);
            });
        }, this), callback);
    }, this));
}
