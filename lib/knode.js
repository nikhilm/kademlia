/*
 * Copyright (C) 2011-2012 by Nikhil Marathe <nsm.nikhil@gmail.com>
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
}

exports.KNode.prototype._MSG = function(type, params) {
    // NOTE: always keep this.self last. This way users of _MSG
    // don't have to worry about accidentally overriding self properties
    return _.extend({ type: type}, params, this.self);
}

exports.KNode.prototype._onMessage = function(message) {
    if (!message.type || typeof message.type !== 'string')
        return;

    var methodName = '_on' + _.str.titleize(_.str.camelize(message.type.toLowerCase()));
    var action = this[methodName];
    if (action) {
        this._updateContact(MC(message));
        _.bind(action, this)(message);
    }
    else
        console.warn("Unknown message", message);
}

exports.KNode.prototype._onPing = function(message) {
    // this can be made more intelligent such that
    // if an outgoing message is present, piggyback the pong
    // onto it rather than sending it separately
    this._rpc.send(MC(message), this._MSG('PONG', {'replyTo': MID(message)}));
}

exports.KNode.prototype._updateContact = function(contact, cb) {
    if (!contact)
        return;
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
    else if (bucket.size() < constants.K) {
        bucket.add(contact);
        callback();
    }
    else {
        this._rpc.send(bucket.get(0), this._MSG('PING'),
            _.bind(function(err, message) {
                if( err ) {
                    // add new contact, old one is dead
                    bucket.removeIndex(0);
                    bucket.add(contact);
                }
                else {
                }
                callback();
            }, this)
        );
    }
}

// TODO: handle large values which
// won't fit in single UDP packets
exports.KNode.prototype._onStore = function(message) {
    if (!message.key || message.key.length !== constants.B/4)
        return;
    if (!message.value)
        return;
    this._storage[message.key] = _.clone(message.value);
    this._rpc.send(MC(message), this._MSG('STORE_REPLY', {
        'replyTo': MID(message),
        'status': true
    }));
}

// This is just to prevent Unknown message errors
exports.KNode.prototype._onStoreReply = function() {}

exports.KNode.prototype._onFindValue = function(message) {
    if (!message.key || message.key.length !== constants.B/4)
        return;
    if (this._storage.hasOwnProperty(message.key)) {
        this._rpc.send(MC(message), this._MSG('FIND_VALUE_REPLY', {
            'replyTo': MID(message),
            'found': true,
            'value': this._storage[message.key]
        }));
    }
    else {
        var messageContact = MC(message);
        if (!messageContact)
            return;
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
        if (!contact)
            return;

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

exports.KNode.prototype._refreshBucket = function(bucketIndex, callback) {
    var random = util.randomInBucketRangeBuffer(bucketIndex);
    this._iterativeFindNode(random.toString('hex'), callback);
}

// this is a primitive operation, no network activity allowed
exports.KNode.prototype._onFindNode = function(message) {
    if (!message.key || message.key.length !== constants.B/4 || !MC(message))
        return;

    var contacts = this._findClosestNodes(message.key, constants.K, MC(message).nodeID);

    this._rpc.send(MC(message), this._MSG('FIND_NODE_REPLY', {
        'replyTo': MID(message),
        'contacts': contacts
    }));
}

// cb should be function(err, type, result)
// where type == 'VALUE' -> result is the value
//       type == 'NODE'  -> result is [list of contacts]
exports.KNode.prototype._iterativeFind = function(key, mode, cb) {
    assert.ok(_.include(['NODE', 'VALUE'], mode));
    var externalCallback = cb || function() {};

    var closestNode = null, previousClosestNode = null;
    var closestNodeDistance = -1;
    var shortlist = this._findClosestNodes(key, constants.ALPHA, this.self.nodeID);
    var contacted = {};
    var foundValue = false;
    var value = null;
    var contactsWithoutValue = [];
    closestNode = shortlist[0];
    if (!closestNode) {
        // we aren't connected to the overlay network!
        externalCallback({ message: 'Not connected to overlay network. No peers.'}, mode, null);
        return;
    }
    closestNodeDistance = util.distance(key, closestNode.nodeID);

    function xyz(alphaContacts) {
        // clone because we're going to be modifying inside
        async.forEach(alphaContacts, _.bind(function(contact, callback) {
            this._rpc.send(contact, this._MSG('FIND_'+mode, {
                key: key
            }), _.bind(function(err, message) {
                if (err) {
                    console.log("ERROR in iterativeFind"+_.str.titleize(mode)+" send to", contact);
                    shortlist = _.reject(shortlist, function(el) { return el.nodeID == contact.nodeID; });
                }
                else {
                    this._updateContact(contact);
                    contacted[contact.nodeID] = true;
                    var dist = util.distance(key, contact.nodeID);
                    if (util.buffer_compare(dist, closestNodeDistance) == -1) {
                        previousClosestNode = closestNode;
                        closestNode = contact;
                        closestNodeDistance = dist;
                    }

                    if (message.found && mode == 'VALUE') {
                        foundValue = true;
                        value = message.value;
                    }
                    else {
                        if (mode == 'VALUE') {
                            // not found, so add this contact
                            contactsWithoutValue.push(contact);
                        }
                        shortlist = shortlist.concat(message.contacts);
                        shortlist = _.uniq(shortlist, false /* is sorted? */, function(contact) {
                            return contact.nodeID;
                        });
                    }
                }
                callback();
            }, this));
        }, this), _.bind(function(err) {
            if (foundValue) {
                var thisNodeID = this.self.nodeID;
                console.log("W/O value ", contactsWithoutValue);


                var distances = _.map(contactsWithoutValue, function(contact) {
                    return {
                        distance: util.distance(contact.nodeID, thisNodeID),
                        contact: contact
                    };
                });

                distances.sort(function(a, b) {
                    return util.buffer_compare(a.distance, b.distance);
                });

                if (distances.length >= 1) {
                    var closestWithoutValue = distances[0].contact;

                    console.log("Closest is ", closestWithoutValue);
                    var message = this._MSG('STORE', {
                        'key': key,
                        'value': value
                    });
                    this._rpc.send(closestWithoutValue, message);
                }
                externalCallback(null, 'VALUE', value);
                return;
            }

            if (closestNode == previousClosestNode || shortlist.length >= constants.K) {
                // TODO: do a FIND_* call on all nodes in shortlist
                // who have not been contacted
                externalCallback(null, 'NODE', shortlist);
                return;
            }

            var remain = _.reject(shortlist, function(el) { return contacted[el.nodeID]; })
            if (remain.length == 0)
                externalCallback(null, 'NODE', shortlist);
            else
                _.bind(xyz, this)(_.first(remain, constants.ALPHA));
        }, this));
    }
    _.bind(xyz, this)(shortlist);
}

exports.KNode.prototype._iterativeFindNode = function(nodeID, cb) {
    this._iterativeFind(nodeID, 'NODE', cb);
}

// cb -> function(err, value)
// this does not map over directly to the spec
// rather iterativeFind already does the related things
// if the callback gets a list of contacts, it simply
// assumes the key does not exist in the DHT (atleast with
// available knowledge)
exports.KNode.prototype._iterativeFindValue = function(key, cb) {
    var callback = cb || function() {};
    this._iterativeFind(key, 'VALUE', _.bind(function(err, type, result) {
        if (type == 'VALUE')
            callback(null, result);
        else
            callback({
                'code': 'NOTFOUND',
                'key': key
            }, null);
    }, this));
}

exports.KNode.prototype.toString = function() {
    return "Node " + this.self.nodeID + ":" + this.self.address + ":" + this.self.port;
}

exports.KNode.prototype.debug = function() {
    console.log(this.toString());
    _(this._buckets).each(function(bucket, j) {
        console.log("bucket", j, bucket.toString());
    });
    console.log("store", this._storage);
}

/***** Public API *****/
exports.KNode.prototype.connect = function(address, port, cb) {
    var callback = cb || function() {};
    assert.ok(this.self.nodeID);
    var contact = util.make_contact(address, port);
    async.waterfall([
        _.bind(this._updateContact, this, contact),
        _.bind(this._iterativeFindNode, this, this.self.nodeID),
        _.bind(function(type, contacts, callback) {
            // FIXME: Do we update buckets or does iterativeFindNode do it?
            var leastBucket = _.min(_.keys(this._buckets));
            var bucketsToRefresh = _.filter(_.keys(this._buckets), function(num) { return num >= leastBucket; });
            var queue = async.queue(_.bind(this._refreshBucket, this), 1);
            _.each(bucketsToRefresh, function(bucketId) {
                // wrapper is required because the each iterator is passed
                // 3 arguments (element, index, list) and queue.push interprets
                // the second argument as a callback
                queue.push(bucketId);
            });
            callback(null);
        }, this)
    ]);
}

exports.KNode.prototype.get = function(key, cb) {
    var callback = cb || function() {};
    this._iterativeFindValue(util.id(key), callback);
}

exports.KNode.prototype.set = function(key, value, cb) {
    var callback = cb || function() {};
    var message = this._MSG('STORE', {
        'key': util.id(key),
        'value': value
    });
    this._iterativeFindNode(util.id(key), _.bind(function(err, type, contacts) {
        if (err) {
            callback(err);
            return;
        }
        async.forEach(contacts, _.bind(function(contact, asyncCb) {
            this._rpc.send(contact, message, function() {
                // TODO handle error
                asyncCb(null);
            });
        }, this), callback);
    }, this));
}
