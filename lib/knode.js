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
    this._self = _.defaults({ nodeID: util.nodeID(desc.address, desc.port) }, desc);
    Object.freeze(this._self);

    this._storage = {};
    // object treated as an array
    this._buckets = {};
    this._rpc = new rpc.RPC(this._self, _.bind(this._onMessage, this));

    // DEBUG
    setInterval(_.bind(this.debug, this), 5000);
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

exports.KNode.prototype.ping = function(contact) {

    function onPong(err, message) {
        if (err && err.errno == node_constants.ETIMEDOUT) {
            // TODO: handle peer death
        }
        else {
            assert.equal(message.type, 'PONG');
            this._updateContact(MC(message));
        }
    }

    this._rpc.send(contact, _.extend({'type': 'PING'}, this._self), _.bind(onPong, this));
}

exports.KNode.prototype._onPing = function(message) {
    // this can be made more intelligent such that
    // if an outgoing message is present, piggyback the pong
    // onto it rather than sending it separately
    this._rpc.send(MC(message), _.extend({
        'type': 'PONG',
        'replyTo': MID(message)
    }, this._self));
}

exports.KNode.prototype._updateContact = function(contact) {
    var bucketIndex = util.bucketIndex(this._self.nodeID, contact.nodeID);
    assert.ok(bucketIndex < constants.B);
    if (!this._buckets[bucketIndex])
        this._buckets[bucketIndex] = new Bucket();

    var bucket = this._buckets[bucketIndex];
    contact.lastSeen = Date.now();

    var exists = bucket.contains(contact);
    if( exists ) {
        // move to the end of the bucket
        bucket.remove(contact);
        bucket.add(contact);
    }
    else {
    console.log("New peer to bucket", bucketIndex);
        if( bucket.size() < 3 /*constants.K*/ ) // TODO: FIXME: use constants.K
            bucket.add(contact);
        else { // TODO:
            this._rpc.send(bucket.get(0), _.extend({'type': 'PING'}, this._self),
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
                    }), this);
        }
    }
}

// TODO: handle large values which
// won't fit in single UDP packets
exports.KNode.prototype._onStore = function(message) {
    this._storage[message.key] = _.clone(message.value);
    this._rpc.send(MC(message), _.extend({
        'type': 'STORE_REPLY',
        'replyTo': MID(message),
        'status': true
    }, this._self));
}

exports.KNode.prototype.toString = function() {
    return "Node " + this._self.nodeID + ":" + this._self.address + ":" + this._self.port;
}
exports.KNode.prototype.debug = function() {
    console.log(this.toString());
    _(this._buckets).each(function(bucket, j) {
        //console.log("bucket", j, bucket.toString());
        console.log("bucket", j, bucket.size(), "peers");
    });
}
