Kademlia
==========

A Kademlia DHT implementation in node, ready to be used as
a distributed data store.

Install using `npm install Kademlia`

Use:

    var dht = require('kademlia')
    var node = new dht.KNode({ address: 'IP address', port: portNumber });
    node.connect('existing peer ip', port);
    node.set('key', data, function(err, data) {

    });

    node.get('key', function(err, data) {
        // do stuff with data.
    });
