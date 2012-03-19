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
var crypto = require('crypto');
var _ = require('underscore');

var constants = require('./constants');

/**
 * Create a 20 bit ID of type Buffer from
 * any string
 *
 * Currently uses SHA1
 */
exports.id = function(string) {
    var hash = crypto.createHash('sha1');
    hash.update(string);
    return hash.digest('hex');
}

exports.nodeID = function(address, port) {
    return exports.id(address + ':' + port);
}

/**
 * Convert a 20 bit SHA1 sum (or general hex string)
 * to a Buffer
 */
exports.hex2buf = function(string) {
    var ret = new Buffer(constants.K);
    ret.write(string, 0, 'hex');
    return ret;
}

exports.buffer_compare = function(b1, b2) {
    assert.equal(b1.length, b2.length);
    for( var i = 0; i < b1.length; ++i ) {
        if( b1[i] != b2[i] )
            if( b1[i] < b2[i] ) return -1;
            else return 1;
    }
    return 0;
}

exports.id_compare = function(id1, id2) {
    var id1Buf = exports.hex2buf(id1);
    var id2Buf = exports.hex2buf(id2);
    return exports.buffer_compare(id1Buf, id2Buf);
}

exports.distance = function(id1, id2) {
    var ret = new Buffer(constants.K);
    var id1Buf = exports.hex2buf(id1);
    var id2Buf = exports.hex2buf(id2);
    for( var i = 0; i < constants.K; ++i ) {
        ret[i] = id1Buf[i] ^ id2Buf[i];
    }
    return ret;
}

exports.bucketIndex = function(id1, id2) {
    var d = exports.distance(id1, id2);
    var bno = constants.B;
    for (var i = 0; i < d.length; i++) {
        if (d[i] == 0) {
            bno -= 8;
            continue;
        }

        for (var j = 0; j < 8; j++) {
            if (d[i] & (0x80 >> j)) {
                return --bno;
            }
            else
                bno--;
        }
    }
    return bno;
}

exports.powerOfTwoBuffer = function(exp) {
    assert.ok(exp >= 0 && exp < constants.B);
    var buffer = new Buffer(constants.K);
    buffer.fill(0);
    // we want to set the byte containing the
    // bit to the right left shifted amount

    var byte = parseInt(exp/8);
    buffer[constants.K - byte - 1] = 1 << (exp % 8);
    return buffer;
}

// assuming bucketNo corresponds to power of 2
// ie, bucketNo = n has nodes within distance 2^n <= distance < 2^(n+1)
exports.randomInBucketRangeBuffer = function(bucketNo) {
    var base = exports.powerOfTwoBuffer(bucketNo);
    // randomize all bytes below the power of two
    var byte = parseInt(bucketNo/8);
    for (var i = constants.K - 1; i > (constants.K - byte - 1); i--) {
        base[i] = parseInt(Math.random()*256);
    }
    // also randomize the bits below the number in that byte
    // and remember arrays are off by 1
    for (var i = bucketNo-1; i >= byte*8; i--) {
        var one = Math.random() >= 0.5;
        var shiftAmount = i - byte*8;
        base[constants.K - byte - 1] |= one ? (1 << shiftAmount) : 0;
    }
    return base;
}

exports.message_contact = function(message) {
    if (!message.nodeID
        || typeof message.nodeID !== 'string'
        || message.nodeID.length !== constants.B/4)
        return null;

    if (!message.address || typeof message.address !== 'string')
        return null;

    if (!message.port || typeof message.port !== 'number')
        return null;

    return { nodeID: message.nodeID, address: message.address, port: message.port };
}

exports.message_rpcID = function(message) {
    if (!message.rpcID || typeof message.rpcID !== 'string')
        return null;
    return message.rpcID;
}

exports.make_contact = function(address, port) {
    return { nodeID: exports.nodeID(address, port), address: address, port: port };
}
