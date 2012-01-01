var constants = require('./constants');
var dgram = require('dgram');
var _ = require('underscore');
var hat = require('hat');

exports.Socket = function(bindAddress, callback) {
    this._socket = dgram.createSocket('udp4', _.bind(this._onMessage, this));
    this._socket.bind(bindAddress.port, bindAddress.address || undefined);
    this._callback = callback;
    this._rack = hat.rack(constants.B);
    this._awaitingReply = {};

    // every node requires only one of these this way
    setInterval(_.bind(this._expireRPCs, this), constants.T_RESPONSETIMEOUT + 5);
}

exports.Socket.prototype.send = function(node, message, callback) {
    _.extend(message, { rpcID: this._rack() });
    var data = new Buffer(JSON.stringify(message), 'utf8');
    this._socket.send(data, 0, data.length, node.port, node.address, callback);
    this._awaitingReply[message.rpcID] = Date.now();
}

exports.Socket.prototype.close = function() {
    this._socket.close();
}

exports.Socket.prototype._onMessage = function(data, rinfo) {
    var message = JSON.parse(data.toString('utf8'));
    if (message.replyTo) {
        if (!this._awaitingReply.hasOwnProperty(message.replyTo)) // too late reply, drop it
            return;
        
        delete this._awaitingReply[message.replyTo];
    }
    this._callback(message);
}

exports.Socket.prototype._expireRPCs = function() {
    var now = Date.now();
    var discarded = 0;
    _.keys(this._awaitingReply).forEach(_.bind(function(k) {
        if (now - this._awaitingReply[k] > constants.T_RESPONSETIMEOUT) {
            delete this._awaitingReply[k];
            discarded++;
        }
    }, this));
    //if (discarded)
    //    console.warn("expireRPCs: discarded %d since no reply was received", discarded);
}
