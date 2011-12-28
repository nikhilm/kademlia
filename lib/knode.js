var assert = require('assert');
var constants = require('./constants');
var util = require('./util');
var network = require('./network');
var Bucket = require('./bucket').Bucket;
var _ = require('underscore');

// abbreviate message utilities
var MC = util.message_contact;
var MID = util.message_rpcID;

exports.KNode = function(desc) {
    // TODO: probably want to persist nodeID
    this._self = _.defaults({ nodeID: util.id(desc.address + ':' + desc.port) }, desc);
    console.info("Node", this._self);

    // object treated as an array
    this._buckets = {};
    this._socket = new network.Socket(this._self, _.bind(this._message, this));

    // DEBUG
    setInterval(_.bind(this.debug, this), 5000);
}

exports.KNode.prototype._message = function(message) {
    var action = { 'PING': this._onPing,
      'PONG': this._onPong,
      'STORE': this._onStore,
      'FIND_NODE': this._onFindNode,
      'FIND_VALUE': this._onFindValue,
    }[message.type];

    if (action)
        _.bind(action, this)(message);
    else
        console.warn("Unknown message", message);
}

exports.KNode.prototype.ping = function(contact) {
    this._socket.send(contact, _.extend({'type': 'PING'}, this._self));
}

exports.KNode.prototype._onPing = function(message) {
    // this can be made more intelligent such that
    // if an outgoing message is present, piggyback the pong
    // onto it rather than sending it separately
    console.info("Received PING", message);
    this._updateContact(MC(message));
    this._socket.send(MC(message), _.extend(this._self, {
        'type': 'PONG',
        'replyTo': MID(message)
    }));
}

exports.KNode.prototype._onPong = function(message) {
    console.info("Received PONG", message);
    this._updateContact(MC(message));
}

exports.KNode.prototype._updateContact = function(contact) {
    var bucketIndex = util.bucketIndex(this._self.nodeID, contact.nodeID);
    assert.ok(bucketIndex < constants.K);
    if (!this._buckets[bucketIndex])
        this._buckets[bucketIndex] = new Bucket();

    var bucket = this._buckets[bucketIndex];

    var pos = bucket.indexOf(contact.id);
    if( pos !== -1 ) {
        // move to the end of the bucket
        bucket.contacts.remove(pos);
        bucket.contacts.push(contact);
    }
    else {
        if( bucket.contacts.length < constants.K )
            bucket.contacts.push(contact);
        else { // TODO:
            throw 'TODO';
            network.send(this.contacts[0], function(err) {
                if( err ) {
                    // add new contact, old one is dead
                    this.contacts.remove(0);
                    this.contacts.push(contact);
                }
                // otherwise ignore the new contact
            });
        }
    }
}

exports.KNode.prototype.debug = function() {
    console.log("Node", this._self);
    _(this._buckets).each(function(bucket, j) {
        console.log("bucket", j, bucket);
    });
}
