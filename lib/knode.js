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
    console.log(" <- PINGING ", contact.nodeID, contact.port);

    function onPong(err, message) {
        if (err && err.errno == node_constants.ETIMEDOUT) {
            // TODO: handle peer death
        }
        else {
            assert.equal(message.type, 'PONG');
            this._updateContact(MC(message));
            console.log(" -> PONG", err, message);
        }
    }

    this._rpc.send(contact, _.extend({'type': 'PING'}, this._self), _.bind(onPong, this));
}

exports.KNode.prototype._onPing = function(message) {
    // this can be made more intelligent such that
    // if an outgoing message is present, piggyback the pong
    // onto it rather than sending it separately
    console.log(" -> PING from " + message.nodeID);
    this._rpc.send(MC(message), _.extend(this._self, {
        'type': 'PONG',
        'replyTo': MID(message)
    }));
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
        if( bucket.size() < constants.K )
            bucket.add(contact);
        else { // TODO:
            throw 'TODO';
            this._rpc.send(bucket.get(0), function(err) {
                if( err ) {
                    // add new contact, old one is dead
                    bucket.remove(0);
                    bucket.add(contact);
                }
                // otherwise ignore the new contact
            });
        }
    }
}

// TODO: handle large values which
// won't fit in single UDP packets
exports.KNode.prototype._onStore = function(message) {
    this._storage[message.key] = _.clone(message.value);
    this._rpc.send(MC(message), _.extend(this._self, {
        'type': 'STORE_REPLY',
        'replyTo': MID(message),
        'status': true
    }));
}

exports.KNode.prototype.toString = function() {
    return "Node " + this._self.nodeID + ":" + this._self.address + ":" + this._self.port;
}
exports.KNode.prototype.debug = function() {
    console.log(this.toString());
    _(this._buckets).each(function(bucket, j) {
        console.log("bucket", j, bucket.toString());
    });
}