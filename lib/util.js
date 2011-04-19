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

var crypto = require('crypto');

var _ = require('underscore')._;

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
    return exports.hex2buf(hash.digest('hex'));
}

/**
 * Convert a 20 bit SHA1 sum (or general hex string)
 * to a Buffer
 */
exports.hex2buf = function(string) {
    var ret = new Buffer(constants.k);
    ret.write(string, 0, 'hex');
    return ret;
}

exports.id_compare = function(id1, id2) {
    for( var i = 0; i < constants.k; ++i ) {
        if( id1[i] != id2[i] )
            if( id1[i] < id2[i] ) return -1;
            else return 1;
    }
    return 0;
}

exports.distance = function(id1, id2) {
    var ret = new Buffer(constants.k);
    for( var i = 0; i < constants.k; ++i ) {
        ret[i] = id1[i] ^ id2[i];
    }
    return ret;
}
