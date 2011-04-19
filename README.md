Makademlia
==========

A Kademlia DHT implementation in node, ready to be used as
a distributed data store.

Install using `npm install makademlia`

Use:

    var dht = require('makademlia')
    dht.connect('existing peer ip', port);
    dht.set('key', data);

    dht.get('key', function(err, data) {
        // do stuff with data.
    });
