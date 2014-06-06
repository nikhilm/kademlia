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

/*var compress = require('compress-buffer').compress;
var uncompress = require('compress-buffer').uncompress;*/

var assert = require('assert');
var node_constants = require('constants');
var constants = require('./constants');
var dgram = require('dgram');
var _ = require('underscore');
var hat = require('hat');
var utp = require('utp');
var util = require('./util');

exports.RPC = function(bindAddress, callback, streamPort, getValue) {
    this._socket = dgram.createSocket('udp4', _.bind(this._onMessage, this));
	this._socket.bytesRead = 0;
	this._socket.bytesWritten = 0;
	this._socket.streamRead = undefined;
	this._socket.streamWritten = 0;
	
    this._socket.bind(bindAddress.port, bindAddress.address || undefined);
    this._callback = callback;
    this._rack = hat.rack(constants.B);
    this._awaitingReply = {};
	this.incomingStreams = { }; //index is the key that we are receiving, to avoid receiving from multiple
	var that = this;
	
    // every node requires only one of these this way
    setInterval(_.bind(this._expireRPCs, this), constants.T_RESPONSETIMEOUT + 5);

	if (streamPort) {
		var server = utp.createServer(function(socket) {
			/*   //i don think this will work.
			//instrument socket
			var prevSend = socket.socket.send;
			socket.socket.send = function(message, x, length, port, host) {
				prevSend.apply(this,[message,x,length,port,host]);
				that._socket.streamWritten += length;
			};*/
		
			socket.on('data', function(key) {
				//TODO use a WeakMap cache for already JSONized values
				var valueString = JSON.stringify(getValue(key));
				//console.log(socket.port, bindAddress.port, 'client requests stream ' + key + ' of length ' + valueString.length + ' bytes');
				socket.write(valueString);
				socket.end();
			});
			socket.on('end', function() {
				socket.end();
			});
		});

		server.listen(streamPort);
	}
}



exports.RPC.prototype.send = function(node, message, callback) {
    /*if (_.isFunction(callback)) {
		if (this._awaitingReply[message.rpcID]) {
			console.error('already sent message with same rpcID', new Error().stack);
			return;
		}
	}*/

    if (!node)
        return;
    assert(node.port);
    assert(node.address);
    _.extend(message, { rpcID: this._rack() });
    
	var data = new Buffer(util.messageToString(message), 'utf8');

	//console.log('out', util.messageToString(message), node.address, node.port);	


	/*
	var before = data.length;
	data = compress(data);
	var after = data.length;
	console.log(before, ' -> ', after);*/
	
	/*zlib.gzip(data, function(err, cdata) {
		console.log('compressed: ', data.length, cdata.length);
	});*/
	
    this._socket.send(data, 0, data.length, node.port, node.address);
    if (_.isFunction(callback)) { // only store rpcID if we are expecting a reply
        this._awaitingReply[message.rpcID] = { timestamp: Date.now(), callback: callback };
    }
	this._socket.bytesWritten += data.length;
}

exports.RPC.prototype.close = function() {
    this._socket.close();
}


exports.RPC.prototype._onMessage = function(data, rinfo) {	
	this._socket.bytesRead += rinfo.size;

	//data = uncompress(data);
	
    var message;
    try {		
        message = util.messageFromString(data.toString('utf8'));		
    } catch (e) {
		console.error(e);
        /* we simply drop the message, although this
         * reduces the reliability of the overall network,
         * we really don't want to implement a reliable
         * network over UDP until it is really required.
         */
        return;
    }
	
	message.address = rinfo.address;
	message.port = rinfo.port;
	if (message.fromID) {
		message.id = message.fromID;
		delete message.fromID;
	}
	
    if (message.replyTo && this._awaitingReply.hasOwnProperty(message.replyTo)) {
        var cb = this._awaitingReply[message.replyTo].callback;
        delete this._awaitingReply[message.replyTo];

		if ((message.type === 'FIND_VALUE_REPLY') && (!message.value)) {
			//stream
			//console.log('client connecting for stream');
			if (this.incomingStreams[message.key]) {
				//console.log('avoided extra stream for key', message.key);
				return;
			}

		    var client = this.incomingStreams[message.key] = utp.connect(message.streamPort, message.address);
			var streamSize = message.streamSize;
			var data = new Buffer(streamSize);
			client.write(message.key);
			client.end();

			var that = this;

			var offset = 0;

			client.on('data', function(packet) {
				packet.copy(data, offset);
				offset += packet.length;
			});
			client.on('end', function() {
				var value = JSON.parse(data.toString('utf8'));
				message.value = value;
				client.end();
				delete that.incomingStreams[message.key];
				cb(null, message);				
			});
			client.on('error', function(err) {
				console.error('error streaming message', err, message);
				delete that.incomingStreams[message.key];
				//cb(null, message);
				return;
			});
		}
		else  {
	        cb(null, message);
		}
        return;
    }
    this._callback(message);
}

exports.RPC.prototype._expireRPCs = function() {
    var now = Date.now();
    var discarded = 0;
    _.keys(this._awaitingReply).forEach(_.bind(function(k) {
        if (now - this._awaitingReply[k].timestamp > constants.T_RESPONSETIMEOUT) {
            this._awaitingReply[k].callback({
                errno: node_constants.ETIMEDOUT,
                code: 'ETIMEDOUT',
                rpcID: k
            }, null);
            delete this._awaitingReply[k];
            discarded++;
        }
    }, this));
    //if (discarded)
    //    console.warn("expireRPCs: discarded %d since no reply was received", discarded);
}
