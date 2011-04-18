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

var _ = require('underscore')._;

var constants = require('./constants');
//XXX: var network = require('network');

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

exports.Bucket = Bucket = function() {
    this.contacts = [];
}

Bucket.prototype.findContact = function(id) {
    return _.detect(this.contacts, function(contact) { return contact.id == id });
}

Bucket.prototype.indexOf = function(id) {
    var contact = this.findContact(id);
    return contact ? this.contacts.indexOf(contact) : -1;
}

Bucket.prototype.updateContact = function(contact) {
    var pos = this.indexOf(contact.id);
    if( pos !== -1 ) {
        // move to the end of the bucket
        this.contacts.remove(pos);
        this.contacts.push(contact);
    }
    else {
        if( this.contacts.length < constants.k )
            this.contacts.push(contact);
        else { // TODO:
            network.ping(this.contacts[0], function(err) {
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
